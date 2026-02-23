/**
 * 提示词构建器
 * 将记忆注入到系统提示词中
 */

import type { MemoryRetrievalResult } from './memory-service';

/**
 * 构建带记忆的系统提示词
 * 将三层记忆按格式注入到基础系统提示词中
 * 
 * @param params - 参数
 * @param params.basePrompt - 基础系统提示词
 * @param params.memories - 三层记忆
 * @returns 带记忆的系统提示词
 */
export function buildSystemPromptWithMemory(params: {
  basePrompt: string;
  memories: MemoryRetrievalResult;
}): string {
  const { basePrompt, memories } = params;
  
  // 如果没有任何记忆，直接返回基础提示词
  if (
    memories.userGlobal.length === 0 &&
    memories.agentGlobal.length === 0 &&
    memories.interaction.length === 0
  ) {
    return basePrompt;
  }
  
  // 构建记忆部分
  const memorySections: string[] = [];
  
  // 用户全局记忆：用户偏好
  if (memories.userGlobal.length > 0) {
    memorySections.push(formatMemorySection(
      '用户偏好',
      memories.userGlobal,
      '这些是用户在所有对话中表达过的偏好和习惯'
    ));
  }
  
  // Agent全局记忆：知识库
  if (memories.agentGlobal.length > 0) {
    memorySections.push(formatMemorySection(
      '知识库',
      memories.agentGlobal,
      '这些是你作为助手积累的通用知识'
    ));
  }
  
  // 交互记忆：之前的对话要点
  if (memories.interaction.length > 0) {
    memorySections.push(formatMemorySection(
      '之前的对话要点',
      memories.interaction,
      '这些是你和用户之前的对话中值得记住的内容'
    ));
  }
  
  // 组合完整提示词
  const memoryPrompt = memorySections.join('\n\n');
  
  return `${basePrompt}

---

## 记忆上下文

以下是你应该记住的信息，请在回答时参考：

${memoryPrompt}

---
`;
}

/**
 * 格式化记忆部分
 * 
 * @param title - 部分标题
 * @param memories - 记忆内容数组
 * @param description - 部分描述
 * @returns 格式化后的字符串
 */
function formatMemorySection(
  title: string,
  memories: string[],
  description: string
): string {
  const items = memories.map(m => `- ${m}`).join('\n');
  
  return `### ${title}
${description}

${items}`;
}

/**
 * 构建记忆提取提示词
 * 用于从对话中提取值得记忆的信息
 * 
 * @returns 记忆提取提示词
 */
export function getMemoryExtractionPrompt(): string {
  return `你是一个记忆提取助手。你的任务是从对话中识别并提取值得长期记忆的信息。

请分析以下对话，识别以下类型的信息：
1. 用户偏好：用户明确表达的喜好、习惯、风格偏好等
2. 事实信息：用户分享的个人情况、工作、项目等事实
3. 重要决策：用户做出的重要决定或选择
4. 知识积累：助手提供的有价值的信息或解决方案

请以JSON数组格式输出，每个记忆项包含：
- content: 记忆内容（简洁的一句话）
- type: 类型（user_preference | fact | decision | knowledge）

如果没有值得记忆的信息，输出空数组 []

示例输出：
[
  {"content": "用户偏好使用TypeScript进行开发", "type": "user_preference"},
  {"content": "用户正在开发一个Next.js项目", "type": "fact"}
]

请只输出JSON数组，不要有其他内容。`;
}

/**
 * 判断消息是否包含值得记忆的信息
 * 简单规则判断，避免频繁调用LLM
 * 
 * @param message - 用户或助手消息
 * @returns 是否可能包含值得记忆的信息
 */
export function mightContainMemory(message: string): boolean {
  // 过短的消息不太可能包含有价值信息
  if (message.length < 20) return false;
  
  // 包含以下关键词的消息可能包含有价值信息
  const memoryKeywords = [
    '我喜欢', '我偏好', '我习惯', '我希望', '我想要',
    '我的项目', '我的工作', '我在做', '我正在',
    '记住', '记住这个', '别忘了', '重要',
    '决定', '选择', '采用',
  ];
  
  const lowerMessage = message.toLowerCase();
  return memoryKeywords.some(keyword => lowerMessage.includes(keyword));
}
