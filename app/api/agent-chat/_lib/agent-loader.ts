/**
 * Agent配置加载模块
 * 负责获取Agent配置并验证访问权限
 *
 * 输入：agentId, userId
 * 输出：AgentWithTools 或错误响应
 */

import { getAgentById } from '@/lib/db';
import type { AgentLoadResult, AgentSuccessResult, AgentErrorResult } from './types';

/**
 * 加载Agent配置并验证访问权限
 *
 * 权限规则：
 * - 公开Agent：所有人可用
 * - 私有Agent：仅创建者可用
 *
 * @param agentId - Agent ID
 * @param userId - 当前用户ID
 * @returns Agent加载结果（成功返回Agent配置，失败返回错误响应）
 */
export async function loadAgentConfig(
  agentId: string,
  userId: string
): Promise<AgentLoadResult> {
  // 获取Agent配置（getAgentById 内部已做权限验证）
  const agent = await getAgentById(agentId, userId);

  // Agent不存在或无权访问
  if (!agent) {
    return createErrorResult(404, 'Agent不存在或无权访问');
  }

  // 二次验证：确保私有Agent仅创建者可访问
  // 注意：getAgentById 已做此验证，但显式检查更清晰
  if (!agent.is_public && agent.user_id !== userId) {
    return createErrorResult(403, '无权访问此Agent');
  }

  // 返回成功结果
  return {
    ok: true,
    agent,
  } as AgentSuccessResult;
}

/**
 * 创建错误响应结果
 *
 * @param status - HTTP状态码
 * @param message - 错误消息
 * @returns 错误响应结果
 */
function createErrorResult(status: number, message: string): AgentErrorResult {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    ),
  };
}