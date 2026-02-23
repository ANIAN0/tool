/**
 * 记忆模块导出
 */

// Mem0客户端
export {
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

// 记忆服务
export {
  addMemory,
  retrieveMemories,
  searchMemories,
  getAllMemories,
  deleteMemory,
  updateMemory,
  type MemoryRetrievalResult,
} from './memory-service';

// 提示词构建器
export {
  buildSystemPromptWithMemory,
} from './prompt-builder';

// 记忆提取器
export {
  memoryWorkflow,
} from './memory-extractor';
