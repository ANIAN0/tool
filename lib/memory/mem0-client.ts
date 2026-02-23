/**
 * Mem0客户端配置模块
 * 配置Mem0云服务客户端，封装记忆操作函数
 */

import { MemoryClient } from 'mem0ai';

/**
 * 记忆层级类型
 * - user_global: 用户全局记忆（跨所有Agent）
 * - agent_global: Agent全局记忆（跨所有用户）
 * - interaction: 交互记忆（用户与特定Agent的交互）
 */
export type MemoryType = 'user_global' | 'agent_global' | 'interaction';

// 重新导出MemoryType，供其他模块使用
export { type MemoryType as MemoryTypeExport };

/**
 * 记忆数据接口
 */
export interface Memory {
  // 记忆ID
  id: string;
  // 记忆内容
  memory: string;
  // 用户ID
  userId?: string;
  // Agent ID
  agentId?: string;
  // 记忆类型
  type: MemoryType;
  // 创建时间
  createdAt: string;
  // 更新时间
  updatedAt?: string;
  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * 添加记忆参数
 */
export interface AddMemoryParams {
  // 记忆内容（可以是消息数组或字符串）
  messages: Array<{ role: 'user' | 'assistant'; content: string }> | string;
  // 用户ID
  userId?: string;
  // Agent ID
  agentId?: string;
  // 记忆类型
  type: MemoryType;
  // 额外元数据
  metadata?: Record<string, unknown>;
}

/**
 * 检索记忆参数
 */
export interface SearchMemoryParams {
  // 查询文本
  query: string;
  // 用户ID
  userId?: string;
  // Agent ID
  agentId?: string;
  // 返回数量限制
  limit?: number;
}

/**
 * Mem0客户端实例
 * 使用单例模式，确保全局只有一个客户端实例
 */
let memoryClient: MemoryClient | null = null;

/**
 * 获取Mem0客户端实例
 * 如果未初始化则自动初始化
 * 
 * @returns Mem0客户端实例
 * @throws 如果MEM0_API_KEY未配置
 */
export function getMemoryClient(): MemoryClient {
  // 如果已有实例，直接返回
  if (memoryClient) {
    return memoryClient;
  }
  
  // 检查API Key是否配置
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    throw new Error('MEM0_API_KEY环境变量未配置');
  }
  
  // 创建新的客户端实例
  memoryClient = new MemoryClient({ apiKey });
  
  return memoryClient;
}

/**
 * 检查Mem0是否已配置
 * 用于判断是否启用记忆功能
 * 
 * @returns 是否已配置
 */
export function isMemoryConfigured(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * 构建Mem0用户ID
 * 根据记忆类型构建不同的用户ID格式
 * 
 * @param type - 记忆类型
 * @param userId - 用户ID
 * @param agentId - Agent ID
 * @returns Mem0用户ID
 */
export function buildMem0UserId(
  type: MemoryType,
  userId?: string,
  agentId?: string
): string {
  switch (type) {
    case 'user_global':
      // 用户全局记忆：直接使用用户ID
      return userId || 'anonymous';
    
    case 'agent_global':
      // Agent全局记忆：使用agent_前缀
      return `agent_${agentId || 'default'}`;
    
    case 'interaction':
      // 交互记忆：组合用户ID和Agent ID
      return `${userId || 'anonymous'}_${agentId || 'default'}`;
    
    default:
      return userId || 'anonymous';
  }
}

/**
 * 构建记忆元数据
 * 包含记忆类型和相关ID
 * 
 * @param type - 记忆类型
 * @param userId - 用户ID
 * @param agentId - Agent ID
 * @returns 元数据对象
 */
export function buildMemoryMetadata(
  type: MemoryType,
  userId?: string,
  agentId?: string
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    type,
  };
  
  // 用户全局记忆不存储agentId
  if (type !== 'agent_global' && userId) {
    metadata.user_id = userId;
  }
  
  // Agent全局记忆不存储userId
  if (type !== 'user_global' && agentId) {
    metadata.agent_id = agentId;
  }
  
  return metadata;
}

/**
 * 解析Mem0返回的记忆数据
 * 统一转换为标准格式
 * 
 * @param mem0Memory - Mem0返回的记忆对象
 * @returns 标准格式的记忆对象
 */
export function parseMem0Memory(mem0Memory: unknown): Memory {
  const m = mem0Memory as Record<string, unknown>;
  const metadata = (m.metadata as Record<string, unknown>) || {};
  
  return {
    id: m.id as string,
    memory: m.memory as string,
    userId: m.user_id as string | undefined,
    agentId: metadata.agent_id as string | undefined,
    type: (metadata.type as MemoryType) || 'interaction',
    createdAt: m.created_at as string,
    updatedAt: m.updated_at as string | undefined,
    metadata,
  };
}
