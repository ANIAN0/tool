/**
 * Skills 公共设施模块统一导出
 *
 * 提供完整的 Skill 能力：
 * - 核心类型定义（core-types.ts）
 * - 加载和执行（loader.ts）
 * - 发现和验证（discovery.ts）
 * - 工具定义（skill-tool.ts）
 * - 服务层（skill-service.ts）
 */

// ==================== 核心类型导出 ====================

export type {
  SkillMetadata,
  SkillContext,
  SkillResult,
  SkillFunction,
  SkillDefinition,
  SkillMeta,
} from './core-types';

// ==================== 加载器导出 ====================

export {
  registerSkill,
  loadSkill,
  loadSkills,
  executeSkill,
  getRegisteredSkills,
  clearSkillRegistry,
} from './loader';

// ==================== 发现模块导出 ====================

export {
  discoverSkills,
  validateSkillMetadata,
} from './discovery';

// ==================== 工具类型导出 ====================

export type {
  SkillToolInput,
  SkillExecutionContext,
  SkillToolResult,
  SkillErrorType,
  SkillToolDefinition,
} from './types';

export {
  validateSkillFile,
  validateSkillDirectory,
  extractSkillMetadata,
  extractSkillBody,
  type SkillDirectoryValidation,
} from './validator';

// ==================== Skill 工具导出 ====================

export {
  executeSkillSchema,
  createSkillToolDefinition,
  createSpecificSkillToolDefinition,
  createSkillToolDefinitions,
  createToolFromSkillDefinition,
} from './skill-tool';

// ==================== Skill 服务导出 ====================

export {
  getAgentSkillDataInfos,
  getAgentsSkillDataInfosBatch,
  loadAgentSkills,
  loadAgentsSkillsBatch,
  createAgentSkillTools,
  registerSkillDefinition,
  registerSkillDefinitions,
  cleanupSkills,
  getRegisteredSkillMetas,
  isSkillRegistered,
  getSkillDefinition,
  type SkillLoadOptions,
  type SkillLoadResult,
} from './skill-service';