/**
 * Skill 类型定义
 */

/**
 * Skill 元数据接口（frontmatter 格式）
 */
export interface SkillMetadata {
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** Skill 版本 */
  version?: string;
  /** 作者信息 */
  author?: string;
  /** 所需权限 */
  permissions?: string[];
  /** 依赖项 */
  dependencies?: string[];
}

/**
 * Skill 执行上下文
 */
export interface SkillContext {
  /** 用户 ID */
  userId: string;
  /** Agent ID */
  agentId?: string;
  /** 对话 ID */
  conversationId?: string;
  /** 工作目录 */
  workingDirectory: string;
}

/**
 * Skill 执行结果
 */
export interface SkillResult<T = unknown> {
  /** 执行是否成功 */
  success: boolean;
  /** 执行结果数据 */
  data?: T;
  /** 错误信息（失败时） */
  error?: string;
  /** 执行日志 */
  logs?: string[];
}

/**
 * Skill 函数类型定义
 */
export type SkillFunction<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: SkillContext
) => Promise<SkillResult<TOutput>>;

/**
 * Skill 定义接口
 */
export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  /** Skill 元数据 */
  metadata: SkillMetadata;
  /** 输入参数 JSON Schema */
  inputSchema: Record<string, unknown>;
  /** 执行函数 */
  execute: SkillFunction<TInput, TOutput>;
}

/**
 * Skill 元数据（轻量级，用于发现）
 */
export interface SkillMeta {
  /** Skill ID（文件路径或唯一标识） */
  id: string;
  /** Skill 名称 */
  name: string;
  /** Skill 描述 */
  description: string;
  /** 版本 */
  version?: string;
  /** 作者 */
  author?: string;
  /** 文件路径 */
  filePath: string;
}
