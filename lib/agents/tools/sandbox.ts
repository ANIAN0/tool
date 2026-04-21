/**
 * Sandbox工具模块
 * 提供沙盒环境下的命令执行、文件读写能力
 */

import { getSandboxToolsWithContext } from '@/lib/sandbox';
import type { SandboxToolContext } from '@/lib/sandbox';

/**
 * 创建Sandbox工具
 * 用于在沙盒环境中执行bash命令、读写文件
 *
 * @param context 工具执行上下文（包含 conversationId 和 userId）
 * @returns 沙盒工具集合（bash、readFile、writeFile）
 */
export function createSandboxTools(context: SandboxToolContext) {
  // 调用现有的沙盒工具创建函数
  return getSandboxToolsWithContext(context);
}

// 导出上下文类型，供外部使用
export type { SandboxToolContext };