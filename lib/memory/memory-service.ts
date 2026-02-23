/**
 * 三层记忆管理服务
 * 实现用户全局、Agent全局、交互三层记忆的存取逻辑
 */

import {
  getMemoryClient,
  isMemoryConfigured,
  buildMem0UserId,
  buildMemoryMetadata,
  parseMem0Memory,
  type Memory,
  type MemoryType,
  type AddMemoryParams,
  type SearchMemoryParams,
} from './mem0-client';

/**
 * 三层记忆检索结果
 */
export interface MemoryRetrievalResult {
  // 用户全局记忆
  userGlobal: string[];
  // Agent全局记忆
  agentGlobal: string[];
  // 交互记忆
  interaction: string[];
  // 原始记忆对象（用于调试和管理）
  raw?: {
    userGlobal: Memory[];
    agentGlobal: Memory[];
    interaction: Memory[];
  };
}

/**
 * 添加记忆
 * 将记忆存储到Mem0，根据类型自动设置元数据
 * 
 * @param params - 添加记忆参数
 * @returns 记忆ID
 */
export async function addMemory(params: AddMemoryParams): Promise<string> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    console.warn('Mem0未配置，跳过记忆存储');
    return '';
  }
  
  const client = getMemoryClient();
  
  // 构建用户ID和元数据
  const mem0UserId = buildMem0UserId(params.type, params.userId, params.agentId);
  const metadata = {
    ...buildMemoryMetadata(params.type, params.userId, params.agentId),
    ...params.metadata,
  };
  
  // 准备消息格式
  let messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  if (typeof params.messages === 'string') {
    // 如果是字符串，转换为消息格式
    messages = [{ role: 'user' as const, content: params.messages }];
  } else {
    messages = params.messages;
  }
  
  try {
    // 调用Mem0添加记忆API
    const result = await client.add(messages, {
      user_id: mem0UserId,
      metadata,
      version: 'v2',
    });
    
    // 返回记忆ID
    if (Array.isArray(result) && result.length > 0) {
      return (result[0] as { id?: string }).id || '';
    }
    return '';
  } catch (error) {
    console.error('添加记忆失败:', error);
    throw error;
  }
}

/**
 * 检索记忆
 * 从三层记忆中检索相关内容
 * 
 * @param params - 检索参数
 * @returns 三层记忆检索结果
 */
export async function retrieveMemories(
  params: SearchMemoryParams
): Promise<MemoryRetrievalResult> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    return {
      userGlobal: [],
      agentGlobal: [],
      interaction: [],
    };
  }
  
  const client = getMemoryClient();
  const limit = params.limit || 5;
  
  // 并行检索三层记忆
  const [userGlobalResult, agentGlobalResult, interactionResult] = await Promise.all([
    // 1. 检索用户全局记忆
    params.userId
      ? client.search(params.query, {
          user_id: buildMem0UserId('user_global', params.userId),
          limit,
          version: 'v2',
        })
      : null,
    
    // 2. 检索Agent全局记忆
    params.agentId
      ? client.search(params.query, {
          user_id: buildMem0UserId('agent_global', undefined, params.agentId),
          limit,
          version: 'v2',
        })
      : null,
    
    // 3. 检索交互记忆
    params.userId && params.agentId
      ? client.search(params.query, {
          user_id: buildMem0UserId('interaction', params.userId, params.agentId),
          limit,
          version: 'v2',
        })
      : null,
  ]);
  
  // 解析结果
  const userGlobal = parseSearchResult(userGlobalResult);
  const agentGlobal = parseSearchResult(agentGlobalResult);
  const interaction = parseSearchResult(interactionResult);
  
  return {
    userGlobal: userGlobal.map(m => m.memory),
    agentGlobal: agentGlobal.map(m => m.memory),
    interaction: interaction.map(m => m.memory),
    raw: {
      userGlobal,
      agentGlobal,
      interaction,
    },
  };
}

/**
 * 搜索单一类型记忆（用于记忆管理工作流）
 * 返回带 id 的记忆数组，便于后续更新/删除操作
 * 
 * @param params - 搜索参数
 * @returns 记忆数组（带 id）
 */
export async function searchMemories(params: {
  query: string;
  type: MemoryType;
  userId?: string;
  agentId?: string;
  limit?: number;
}): Promise<Array<{ id: string; memory: string }>> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    return [];
  }
  
  const client = getMemoryClient();
  const limit = params.limit || 5;
  
  try {
    // 构建 Mem0 用户 ID
    const mem0UserId = buildMem0UserId(params.type, params.userId, params.agentId);
    
    // 调用 Mem0 搜索 API
    const result = await client.search(params.query, {
      user_id: mem0UserId,
      limit,
      version: 'v2',
    });
    
    // 解析结果
    const memories = parseSearchResult(result);
    return memories.map(m => ({ id: m.id, memory: m.memory }));
  } catch (error) {
    console.error('搜索记忆失败:', error);
    return [];
  }
}

/**
 * 解析搜索结果
 * 
 * @param result - Mem0搜索结果
 * @returns 记忆数组
 */
function parseSearchResult(result: unknown): Memory[] {
  if (!result) return [];
  
  const r = result as { results?: unknown[] };
  if (!r.results || !Array.isArray(r.results)) return [];
  
  return r.results.map(parseMem0Memory);
}

/**
 * 获取所有记忆
 * 用于管理界面展示
 * 
 * @param type - 记忆类型
 * @param userId - 用户ID（可选）
 * @param agentId - Agent ID（可选）
 * @returns 记忆数组
 */
export async function getAllMemories(params: {
  type: MemoryType;
  userId?: string;
  agentId?: string;
}): Promise<Memory[]> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    return [];
  }
  
  const client = getMemoryClient();
  const mem0UserId = buildMem0UserId(params.type, params.userId, params.agentId);
  
  try {
    // 获取所有记忆
    const result = await client.getAll({
      user_id: mem0UserId,
    });
    
    // 解析结果
    if (Array.isArray(result)) {
      return result.map(parseMem0Memory);
    }
    
    return [];
  } catch (error) {
    console.error('获取记忆列表失败:', error);
    return [];
  }
}

/**
 * 删除记忆
 * 
 * @param memoryId - 记忆ID
 * @returns 是否成功
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    return false;
  }
  
  const client = getMemoryClient();
  
  try {
    await client.delete(memoryId);
    return true;
  } catch (error) {
    console.error('删除记忆失败:', error);
    return false;
  }
}

/**
 * 更新记忆
 * 
 * @param memoryId - 记忆ID
 * @param content - 新的记忆内容
 * @returns 是否成功
 */
export async function updateMemory(
  memoryId: string,
  content: string
): Promise<boolean> {
  // 检查是否配置了Mem0
  if (!isMemoryConfigured()) {
    return false;
  }
  
  const client = getMemoryClient();
  
  try {
    // Mem0的update方法使用text参数
    await client.update(memoryId, { text: content });
    return true;
  } catch (error) {
    console.error('更新记忆失败:', error);
    return false;
  }
}
