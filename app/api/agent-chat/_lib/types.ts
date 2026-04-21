/**
 * Agent Chat API 内部类型定义
 * 用于请求解析、响应构建、认证验证等模块
 */

import type { UIMessage } from "ai";
import type { NextResponse } from "next/server";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { UserModel } from "@/lib/db";

/**
 * 聊天请求体结构
 * 前端发送的请求数据格式
 */
export interface ChatRequestBody {
  /** 单条新消息（前端只发送最后一条） */
  message: UIMessage;
  /** 对话ID（可选，首次对话时可能为空） */
  conversationId?: string;
  /** Agent ID（必需） */
  agentId: string;
}

/**
 * 解析成功结果
 * 包含解析后的请求数据
 */
export interface ParseSuccessResult {
  ok: true;
  /** 解析后的请求体数据 */
  data: ChatRequestBody;
}

/**
 * 解析失败结果
 * 包含错误响应对象
 */
export interface ParseErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: NextResponse;
}

/**
 * 请求解析结果类型
 * 成功返回数据，失败返回错误响应
 */
export type ParseResult = ParseSuccessResult | ParseErrorResult;

// ==================== 认证验证结果类型 ====================

/**
 * 认证成功结果
 * 包含验证后的用户ID
 */
export interface AuthSuccessResult {
  ok: true;
  /** 认证成功后的用户ID */
  userId: string;
}

/**
 * 认证失败结果
 * 包含错误响应对象
 */
export interface AuthErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * 认证验证结果类型
 * 成功返回 userId，失败返回错误响应
 */
export type AuthContextResult = AuthSuccessResult | AuthErrorResult;

// ==================== Agent加载结果类型 ====================

/**
 * Agent加载成功结果
 * 包含验证后的Agent配置
 */
export interface AgentSuccessResult {
  ok: true;
  /** Agent配置（含工具信息） */
  agent: import('@/lib/db/schema').AgentWithTools;
}

/**
 * Agent加载失败结果
 * 包含错误响应对象
 */
export interface AgentErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * Agent加载结果类型
 * 成功返回Agent配置，失败返回错误响应
 */
export type AgentLoadResult = AgentSuccessResult | AgentErrorResult;

// ==================== 模型解析结果类型 ====================

/**
 * 模型解析成功结果
 * 包含构建好的聊天模型和相关配置
 */
export interface ModelResolveSuccessResult {
  ok: true;
  /** 构建好的聊天模型实例（LanguageModelV3） */
  chatModel: LanguageModelV3;
  /** 模型名称（用于日志和客户端显示） */
  modelName: string;
  /** 用户模型配置（用于获取 context_limit 等） */
  userModel: UserModel;
  /** 模型上下文上限（token 数） */
  contextLimit: number;
}

/**
 * 模型解析失败结果
 * 包含错误响应对象
 */
export interface ModelResolveErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * 模型解析结果类型
 * 成功返回模型实例，失败返回错误响应
 */
export type ModelResolveResult = ModelResolveSuccessResult | ModelResolveErrorResult;

// ==================== 会话管理结果类型 ====================

/**
 * 会话验证成功结果
 * 包含验证后的会话ID
 */
export interface ConversationSuccessResult {
  ok: true;
  /** 会话ID（已验证存在且权限正确） */
  conversationId: string;
}

/**
 * 会话验证失败结果
 * 包含错误响应对象
 */
export interface ConversationErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * 会话验证结果类型
 * 成功返回 conversationId，失败返回错误响应
 */
export type ConversationResult = ConversationSuccessResult | ConversationErrorResult;

/**
 * 历史消息加载成功结果
 * 包含历史消息列表
 */
export interface HistorySuccessResult {
  ok: true;
  /** 历史消息（UIMessage 格式） */
  messages: UIMessage[];
}

/**
 * 历史消息加载失败结果
 * 包含错误响应对象
 */
export interface HistoryErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * 历史消息加载结果类型
 * 成功返回消息列表，失败返回错误响应
 */
export type HistoryResult = HistorySuccessResult | HistoryErrorResult;

/**
 * 创建对话的参数类型
 * 用于 ensureConversation 函数创建新对话
 */
export interface EnsureConversationParams {
  /** 会话ID（必需） */
  conversationId: string;
  /** 用户ID（用于权限验证） */
  userId: string;
  /** Agent ID（关联到对话） */
  agentId: string;
  /** 模型名称（用于创建对话） */
  modelName: string;
  /** 用户消息（用于提取标题） */
  message: UIMessage;
}

// ==================== 响应构建配置类型 ====================

/**
 * 流式响应构建配置
 * 用于 buildStreamResponse 函数的参数
 */
export interface StreamResponseConfig {
  /** 对话ID，用于保存消息和更新统计 */
  conversationId: string;
  /** 模型上下文上限，传递给客户端显示 */
  contextLimit: number;
  /** 模型名称，传递给客户端显示 */
  modelName: string;
  /** MCP 运行时清理函数，请求结束时释放连接 */
  mcpCleanup: (() => Promise<void>) | null;
}

// ==================== 运行时创建结果类型 ====================

/**
 * 运行时创建参数
 * 用于 createRuntime 函数的参数
 */
export interface CreateRuntimeParams {
  /** Agent配置（含工具信息） */
  agent: import('@/lib/db/schema').AgentWithTools;
  /** 用户ID（用于沙盒上下文和Skill加载） */
  userId: string;
  /** 对话ID（用于沙盒上下文和Skill加载） */
  conversationId: string;
}

/**
 * 运行时创建成功结果
 * 包含工具集合、系统提示词和清理函数
 */
export interface RuntimeSuccessResult {
  ok: true;
  /** 运行时工具集合（合并沙盒工具和MCP工具） */
  tools: import('ai').ToolSet;
  /** 系统提示词（含Skill预置提示词） */
  systemPrompt: string;
  /** MCP运行时清理函数，请求结束时释放连接 */
  mcpCleanup: (() => Promise<void>) | null;
}

/**
 * 运行时创建失败结果
 * 包含错误响应对象
 */
export interface RuntimeErrorResult {
  ok: false;
  /** 错误响应，可直接返回给客户端 */
  response: Response;
}

/**
 * 运行时创建结果类型
 * 成功返回运行时上下文，失败返回错误响应
 */
export type RuntimeResult = RuntimeSuccessResult | RuntimeErrorResult;