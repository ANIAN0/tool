/**
 * Agent对话API - 组装者（Orchestrator）
 */

import { NextRequest, NextResponse } from "next/server";
import {
  parseChatRequestBody, getAuthContext, loadAgentConfig, resolveModel, wrapModel,
  ensureConversation, loadHistory, saveUserMessage, createRuntime, executeAgent, buildStreamResponse,
} from "./_lib";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await parseChatRequestBody(req); if (!body.ok) return body.response; // 解析请求
    const auth = await getAuthContext(req); if (!auth.ok) return auth.response; // 认证
    const agent = await loadAgentConfig(body.data.agentId, auth.userId); if (!agent.ok) return agent.response; // 加载Agent
    const convId = body.data.conversationId;
    if (!convId) return new Response(JSON.stringify({ error: "对话ID不能为空" }), { status: 400, headers: { "Content-Type": "application/json" } });
    // 先解析模型，再创建对话（确保 modelName 正确传入）
    const model = await resolveModel(agent.agent.user_id, agent.agent.model_id, auth.userId); if (!model.ok) return model.response; // 解析模型
    const conv = await ensureConversation({ conversationId: convId, userId: auth.userId, agentId: agent.agent.id, modelName: model.modelName, message: body.data.message }); if (!conv.ok) return conv.response; // 确保对话
    const runtime = await createRuntime({ agent: agent.agent, userId: auth.userId, conversationId: conv.conversationId }); if (!runtime.ok) return runtime.response; // 创建运行时
    const history = await loadHistory(conv.conversationId); if (!history.ok) return history.response; // 加载历史
    await saveUserMessage(conv.conversationId, body.data.message); // 保存用户消息
    const wrappedModel = wrapModel(model.chatModel, { conversationId: conv.conversationId, contextLimit: model.contextLimit }); // 包装模型
    const result = await executeAgent(wrappedModel, runtime.systemPrompt, runtime.tools, history.messages, body.data.message); // 执行Agent
    return buildStreamResponse(result, { conversationId: conv.conversationId, contextLimit: model.contextLimit, modelName: model.modelName, mcpCleanup: runtime.mcpCleanup }); // 构建响应
  } catch (error) {
    // 捕获未预期的异常，防止直接抛出 500
    console.error("[agent-chat] 未处理错误:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}