/**
 * Supabase 公共设施模块统一导出
 *
 * 提供 Supabase 客户端和存储操作能力：
 * - 客户端配置（client.ts）
 * - 文件存储操作（storage.ts）
 */

// ==================== 客户端导出 ====================

export {
  isSupabaseConfigured,
  getSupabaseServerClient,
  getSupabaseClient,
  SKILLS_BUCKET,
} from './client';

// ==================== 存储操作导出 ====================

export {
  getSkillStoragePath,
  uploadSkillFile,
  downloadSkillFile,
  deleteSkillDirectory,
  calculateFileHash,
  uploadSkillDirectory,
  downloadSkillDirectory,
  calculateDirectoryHash,
} from './storage';

// ==================== 类型导出 ====================

export type {
  SkillUploadResult,
  SkillDownloadResult,
  SkillDirectoryDownloadResult,
  SkillDirectoryUploadResult,
} from './storage';