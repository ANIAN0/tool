/**
 * 运行时创建模块
 *
 * 职责：
 * - 加载 Skills 到沙盒
 * - 构建系统提示词（含 Skill 预置提示词）
 * - 创建沙盒工具（绑定会话上下文）
 * - 构建 MCP 运行时工具并合并
 * - 返回运行时上下文
 */

import type { ToolSet, LanguageModel, UIMessage, StreamTextResult, StopCondition } from "ai";
import { ToolLoopAgent, stepCountIs, convertToModelMessages } from "ai";
import type {
  CreateRuntimeParams,
  RuntimeSuccessResult,
  RuntimeResult,
} from "./types";
import type { AgentWithTools } from "@/lib/schemas";
import { getSandboxToolsWithContext, loadSkillsToSandbox, isSandboxEnabled } from "@/lib/infra/sandbox";
import { getAgentSkillsInfo, getAgentMcpRuntimeToolConfigs } from "@/lib/db/agents";
import { getTemplateById, getTemplateDefaultConfig } from "@/lib/agents/templates";
import { createAgentMcpRuntimeTools } from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";

/**
 * 解析模板配置生成停止条件
 *
 * 执行流程：
 * 1. 获取模板定义
 * 2. 解析模板配置JSON
 * 3. 使用模板的 createStopCondition 生成停止条件对象
 * 4. 转换为 AI SDK 的 StopCondition 函数
 *
 * @param agent Agent配置（含 template_id 和 template_config）
 * @returns AI SDK 的 StopCondition 函数
 */
function parseStopConditionFromTemplate(
  agent: AgentWithTools
): StopCondition<ToolSet> {
  // 获取模板定义
  const template = getTemplateById(agent.template_id);
  if (!template) {
    // 模板不存在时使用默认值
    console.warn(`[Runtime] 模板 ${agent.template_id} 不存在，使用默认步数 20`);
    return stepCountIs(20);
  }

  // 解析模板配置 JSON
  let config: Record<string, unknown>;
  if (agent.template_config) {
    try {
      config = JSON.parse(agent.template_config);
    } catch {
      console.warn("[Runtime] 模板配置JSON解析失败，使用默认配置");
      config = getTemplateDefaultConfig(agent.template_id);
    }
  } else {
    // 无配置时使用模板默认配置
    config = getTemplateDefaultConfig(agent.template_id);
  }

  // 使用模板的 createStopCondition 生成停止条件对象
  const stopConditionObj = template.createStopCondition(config);

  // 根据停止条件类型转换为 AI SDK StopCondition
  if (stopConditionObj.type === "stepCount") {
    const maxSteps = (stopConditionObj.maxSteps as number) ?? 20;
    // 确保步数在合理范围内
    const safeMaxSteps = Math.max(1, Math.min(100, maxSteps));
    return stepCountIs(safeMaxSteps);
  }

  // 未知类型时使用默认值
  console.warn(`[Runtime] 未知的停止条件类型 ${stopConditionObj.type}，使用默认步数 20`);
  return stepCountIs(20);
}

/**
 * 创建运行时上下文
 *
 * 执行流程：
 * 1. 加载 Skills 到沙盒（如果沙盒启用且 Agent 有配置 Skill）
 * 2. 构建系统提示词（包含 Skill 预置提示词）
 * 3. 创建沙盒工具（绑定会话上下文）
 * 4. 构建 MCP 运行时工具并合并（best-effort，失败时降级）
 * 5. 返回运行时上下文
 *
 * @param params 创建参数（agent、userId、conversationId）
 * @returns 运行时创建结果（成功返回运行时上下文，失败返回错误响应）
 */
export async function createRuntime(
  params: CreateRuntimeParams
): Promise<RuntimeResult> {
  const { agent, userId, conversationId } = params;

  try {
    // 获取 Agent 配置的 Skills 信息
    const agentSkills = await getAgentSkillsInfo(agent.id);

    // 加载 Skill 到沙盒（如果沙盒启用且 Agent 有配置 Skill）
    let skillPresetPrompt = "";
    if (isSandboxEnabled() && agentSkills.length > 0) {
      // 尝试加载 Skills 到沙盒工作区
      const skillResult = await loadSkillsToSandbox(userId, agent.id, conversationId);
      if (skillResult.success) {
        // 成功加载，获取预置提示词（用于告知 AI 有哪些 Skills 可用）
        skillPresetPrompt = skillResult.presetPrompt;
      } else {
        // 加载失败时记录警告，系统提示词中不包含 Skill 信息
        console.warn("[Runtime] Skill 加载失败，Skill 功能不可用:", skillResult.errors);
      }
    }

    // 构建系统提示词（包含 Skill 预置提示词）
    let systemPrompt = agent.system_prompt || "你是一个有帮助的AI助手。";
    if (skillPresetPrompt) {
      // 将 Skill 预置提示词追加到系统提示词末尾
      systemPrompt = `${systemPrompt}\n\n${skillPresetPrompt}`;
    }

    // 创建沙盒工具（绑定会话上下文）
    const sandboxTools = getSandboxToolsWithContext({
      conversationId,
      userId,
    });

    // 初始化运行时工具集合，默认仅包含系统工具（sandbox）
    let runtimeTools: ToolSet = sandboxTools;
    // 初始化 MCP 运行时清理函数，用于请求结束统一释放连接
    let mcpRuntimeCleanup: (() => Promise<void>) | null = null;

    try {
      // 从数据库获取 Agent 绑定的 MCP 工具配置
      const mcpConfigs = await getAgentMcpRuntimeToolConfigs(agent.id, agent.user_id);

      // 转换配置格式为 mcp-runtime 所需格式
      const servers = mcpConfigs.map(c => ({
        id: c.serverId,
        name: c.serverName,
        url: c.serverUrl,
        headers: c.serverHeaders,
        enabled: c.serverEnabled,
      }));
      const tools = mcpConfigs.map(c => ({
        serverId: c.serverId,
        toolName: c.toolName,
      }));

      // 按 Agent 绑定关系构建 MCP 运行时工具（best-effort）
      const mcpRuntime = await createAgentMcpRuntimeTools({ servers, tools });
      // 保存 MCP 清理函数，后续在流式结束时关闭客户端
      mcpRuntimeCleanup = mcpRuntime.cleanup;
      // 合并系统工具与 MCP 工具，保持系统工具优先
      runtimeTools = mergeAgentToolSets({
        systemTools: sandboxTools,
        mcpTools: mcpRuntime.tools,
      });
    } catch (mcpBuildError) {
      // MCP 构建失败时降级为仅系统工具，不阻断整次对话
      console.error("构建Agent MCP运行时工具失败，已降级为仅系统工具:", mcpBuildError);
    }

    // 返回成功结果
    return {
      ok: true,
      tools: runtimeTools,
      systemPrompt,
      mcpCleanup: mcpRuntimeCleanup,
    };
  } catch (error) {
    // 返回错误响应
    console.error("[Runtime] 创建运行时上下文失败:", error);
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "创建运行时上下文失败" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
}

/**
 * 执行 Agent 流式响应
 *
 * @param wrappedModel - 包装后的聊天模型实例
 * @param systemPrompt - 系统提示词
 * @param tools - 运行时工具集合
 * @param history - 历史消息列表
 * @param message - 当前用户消息
 * @param agent - Agent配置（用于解析模板停止条件）
 * @returns Agent 流执行结果
 */
export async function executeAgent(
  wrappedModel: LanguageModel,
  systemPrompt: string,
  tools: ToolSet,
  history: UIMessage[],
  message: UIMessage,
  agent: AgentWithTools
): Promise<StreamTextResult<ToolSet, never>> {
  // 合并历史消息和当前新消息
  const messagesForLLM = [...history, message];
  // 转换消息格式为模型消息格式
  const modelMessages = await convertToModelMessages(messagesForLLM, {
    ignoreIncompleteToolCalls: true,
  });
  // 从模板配置解析停止条件
  const stopWhen = parseStopConditionFromTemplate(agent);
  // 创建 ToolLoopAgent 实例
  const agentInstance = new ToolLoopAgent({
    model: wrappedModel,
    instructions: systemPrompt,
    tools,
    stopWhen, // 使用模板配置的停止条件
  });
  // 执行流式响应
  const result = await agentInstance.stream({ messages: modelMessages });
  return result;
}