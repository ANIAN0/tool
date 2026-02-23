/**
 * 记忆提取器
 * 使用记忆管理Agent和Workflows模式从对话中提取记忆
 */

import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { addMemory, searchMemories } from './memory-service';
import type { MemoryType } from './mem0-client';
import { wrapModelWithDevTools } from '@/lib/ai';

// 创建 SiliconFlow Provider 实例
const siliconflow = createOpenAICompatible({
  name: 'siliconflow',
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
});

// 记忆管理使用的模型（包装 DevTools）
const MEMORY_MODEL = 'Qwen/Qwen3-8B';
const memoryModel = wrapModelWithDevTools(siliconflow(MEMORY_MODEL));

/**
 * 评估结果 Schema
 */
const EvaluationSchema = z.object({
  hasMemoryValue: z.boolean(),
  reasoning: z.string(),
});

/**
 * 分类结果 Schema
 */
const ClassificationSchema = z.object({
  type: z.enum(['user_global', 'agent_global', 'interaction']),
  category: z.enum(['preference', 'fact', 'decision', 'knowledge']),
  memoryText: z.string(),
});

/**
 * 记忆决策 Schema
 */
const DecisionSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'skip']),
  targetMemoryId: z.string().optional(),
  reasoning: z.string(),
});

/**
 * 步骤1：评估是否有记忆价值
 */
async function evaluateMemoryValue(
  userMessage: string,
  assistantMessage: string
): Promise<z.infer<typeof EvaluationSchema>> {
  const { output } = await generateText({
    model: memoryModel,
    output: Output.object({
      schema: EvaluationSchema,
    }),
    prompt: `评估以下对话是否包含值得记忆的信息：

用户消息：
${userMessage}

助手回复：
${assistantMessage}

判断标准（满足任一即为有价值）：
1. 用户偏好：我喜欢、我偏好、我习惯...
2. 个人事实：我是、我在、我的工作...
3. 重要决定：我决定、我选择...
4. 知识积累：新学到的概念、重要的信息...

注意：
- 简单的问候、感谢、确认等不需要记忆
- 已知的常识不需要记忆
- 模糊或不明确的信息不需要记忆

请判断是否有记忆价值，并说明理由。`,
  });

  return output;
}

/**
 * 步骤2：对记忆进行分类
 */
async function classifyMemory(
  userMessage: string,
  assistantMessage: string
): Promise<z.infer<typeof ClassificationSchema>> {
  const { output } = await generateText({
    model: memoryModel,
    output: Output.object({
      schema: ClassificationSchema,
    }),
    prompt: `对以下对话内容进行记忆分类：

用户消息：
${userMessage}

助手回复：
${assistantMessage}

分类规则：

1. 记忆类型（type）：
   - user_global：用户通用偏好或个人事实（对所有Agent有效）
     例如：用户说"我喜欢简洁的回答"、"我是程序员"
   - agent_global：从对话中提取的知识（对该Agent的所有用户有效）
     例如：助手解释了某个概念、提供了某个解决方案
   - interaction：特定交互上下文（仅当前用户与当前Agent）
     例如：用户正在做某个项目、讨论某个具体问题

2. 记忆类别（category）：
   - preference：用户偏好
   - fact：事实信息
   - decision：决策记录
   - knowledge：知识积累

3. 记忆文本（memoryText）：
   提取出简洁、完整的记忆内容（一句话描述）

请根据以上规则进行分类。`,
  });

  return output;
}

/**
 * 步骤4：决策与执行
 */
async function makeDecision(
  memoryText: string,
  existingMemories: Array<{ id: string; memory: string }>
): Promise<z.infer<typeof DecisionSchema>> {
  if (existingMemories.length === 0) {
    return {
      action: 'add',
      reasoning: '没有找到相关记忆，添加新记忆',
    };
  }

  const { output } = await generateText({
    model: memoryModel,
    output: Output.object({
      schema: DecisionSchema,
    }),
    prompt: `分析新记忆与现有记忆的关系，决定如何处理：

新记忆：
${memoryText}

现有记忆：
${existingMemories.map((m, i) => `${i + 1}. [${m.id}] ${m.memory}`).join('\n')}

决策规则：
1. add：新记忆与现有记忆不冲突，添加新记忆
2. update：新记忆是对现有记忆的更新或补充，更新现有记忆
3. delete：新记忆使现有记忆过时或错误，删除现有记忆
4. skip：新记忆与现有记忆重复或无意义，跳过

请做出决策并说明理由。如果选择 update 或 delete，需要指定 targetMemoryId。`,
  });

  return output;
}

/**
 * 记忆管理工作流
 * 按固定流程处理对话，提取和管理记忆
 */
export async function memoryWorkflow(params: {
  userMessage: string;
  assistantMessage: string;
  userId: string;
  agentId: string;
}): Promise<{
  status: 'added' | 'updated' | 'deleted' | 'skipped' | 'error';
  reason: string;
  type?: MemoryType;
}> {
  const { userMessage, assistantMessage, userId, agentId } = params;

  try {
    // 检查环境变量
    if (!process.env.SILICONFLOW_API_KEY) {
      console.warn('[Memory] SILICONFLOW_API_KEY 未配置，跳过记忆提取');
      return { status: 'skipped', reason: 'SILICONFLOW_API_KEY 未配置' };
    }

    // 步骤1：评估记忆价值
    console.log('[Memory] 步骤1：评估记忆价值...');
    const evaluation = await evaluateMemoryValue(userMessage, assistantMessage);

    if (!evaluation.hasMemoryValue) {
      console.log(`[Memory] 无记忆价值: ${evaluation.reasoning}`);
      return { status: 'skipped', reason: evaluation.reasoning };
    }

    // 步骤2：记忆分类
    console.log('[Memory] 步骤2：记忆分类...');
    const classification = await classifyMemory(userMessage, assistantMessage);
    console.log(`[Memory] 分类结果: type=${classification.type}, category=${classification.category}`);

    // 步骤3：检索相关记忆
    console.log('[Memory] 步骤3：检索相关记忆...');
    const existingMemories = await searchMemories({
      query: classification.memoryText,
      type: classification.type,
      userId,
      agentId,
      limit: 3,
    });
    console.log(`[Memory] 找到 ${existingMemories.length} 条相关记忆`);

    // 步骤4：决策与执行
    console.log('[Memory] 步骤4：决策与执行...');
    const decision = await makeDecision(classification.memoryText, existingMemories);

    switch (decision.action) {
      case 'add':
        await addMemory({
          messages: classification.memoryText,
          type: classification.type,
          userId,
          agentId,
          metadata: {
            category: classification.category,
            source: 'workflow',
            extracted_at: new Date().toISOString(),
          },
        });
        console.log(`[Memory] 已添加新记忆: ${classification.memoryText}`);
        return { status: 'added', reason: decision.reasoning, type: classification.type };

      case 'update':
        // TODO: 实现更新逻辑
        console.log(`[Memory] 需要更新记忆: ${decision.targetMemoryId}`);
        return { status: 'updated', reason: decision.reasoning, type: classification.type };

      case 'delete':
        // TODO: 实现删除逻辑
        console.log(`[Memory] 需要删除记忆: ${decision.targetMemoryId}`);
        return { status: 'deleted', reason: decision.reasoning, type: classification.type };

      case 'skip':
      default:
        console.log(`[Memory] 跳过: ${decision.reasoning}`);
        return { status: 'skipped', reason: decision.reasoning };
    }
  } catch (error) {
    console.error('[Memory] 工作流执行失败:', error);
    return { status: 'error', reason: String(error) };
  }
}
