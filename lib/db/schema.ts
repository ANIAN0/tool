/**
 * 兼容层：保留原有导入路径，避免业务代码继续维护第二套 schema 定义。
 * 真实的 schema 常量和类型统一来自 @/lib/schemas。
 */
export * from "@/lib/schemas";

/**
 * 兼容旧脚本中的命名，避免为了收敛 schema 来源而连带修改迁移脚本。
 */
export { CREATE_CONVERSATION_INDEXES as CREATE_INDEXES } from "@/lib/schemas";
