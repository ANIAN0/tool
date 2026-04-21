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

import type { ToolSet, LanguageModel, UIMessage, StreamTextResult } from "ai";
import { ToolLoopAgent, stepCountIs, convertToModelMessages } from "ai";
import type {
  CreateRuntimeParams,
  RuntimeSuccessResult,
  RuntimeErrorResult,
  RuntimeResult,
} from "./types";
import { getSandboxToolsWithContext } from "@/lib/sandbox";
import { createAgentMcpRuntimeTools } from "@/lib/agents/mcp-runtime";
import { mergeAgentToolSets } from "@/lib/agents/toolset-merge";
import { loadSkillsToSandbox } from "@/lib/sandbox/skill-loader";
import { isSandboxEnabled } from "@/lib/sandbox/config";
import { getAgentSkillsInfo } from "@/lib/db/agents";

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
      // 按 Agent 绑定关系构建 MCP 运行时工具（best-effort）
      const mcpRuntime = await createAgentMcpRuntimeTools({
        agentId: agent.id,
        agentOwnerUserId: agent.user_id,
      });
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
 * 构建安全的 MCP 清理函数
 * 用于在请求结束后安全释放 MCP 连接
 *
 * @param mcpCleanup MCP 运行时清理函数（可能为 null）
 * @returns 安全的清理函数（不会抛出错误）
 */
export function buildSafeMcpCleanup(
  mcpCleanup: (() => Promise<void>) | null
): () => Promise<void> {
  // 返回安全清理函数
  return async () => {
    // 没有 MCP 清理函数时直接返回
    if (!mcpCleanup) return;
    try {
      // 执行 MCP 客户端关闭流程
      await mcpCleanup();
    } catch (cleanupError) {
      // 清理失败仅记录告警，不影响主响应
      console.warn("MCP运行时清理失败:", cleanupError);
    }
  };
}

/**
 * 执行 Agent 流式响应
 *
 * @param wrappedModel - 包装后的聊天模型实例
 * @param systemPrompt - 系统提示词
 * @param tools - 运行时工具集合
 * @param history - 历史消息列表
 * @param message - 当前用户消息
 * @returns Agent 流执行结果
 */
export async function executeAgent(
  wrappedModel: LanguageModel,
  systemPrompt: string,
  tools: ToolSet,
  history: UIMessage[],
  message: UIMessage
): Promise<StreamTextResult<ToolSet, never>> {
  // 合并历史消息和当前新消息
  const messagesForLLM = [...history, message];
  // 转换消息格式为模型消息格式
  const modelMessages = await convertToModelMessages(messagesForLLM, {
    ignoreIncompleteToolCalls: true,
  });
  // 创建 ToolLoopAgent 实例
  const agentInstance = new ToolLoopAgent({
    model: wrappedModel,
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(10), // 最大执行步数限制
  });
  // 执行流式响应
  const result = await agentInstance.stream({ messages: modelMessages });
  // 消费流以确保即使客户端断开，服务端也会完成生成
  result.consumeStream();
  return result;
}