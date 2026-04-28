/**
 * Sandbox 工具模块
 * 提供沙盒环境下的命令执行、文件读写能力
 */

import { getSandboxToolsWithContext } from '@/lib/infra/sandbox';
import type { SandboxToolContext } from '@/lib/infra/sandbox';

/**
 * 创建 Sandbox 工具
 * 用于在沙盒环境中执行 bash 命令、读写文件
 *
 * @param context 工具执行上下文（包含 conversationId 和 userId）
 * @returns 沙盒工具集合（bash、readFile、writeFile）
 */
export function createSandboxTools(context: SandboxToolContext) {
  return getSandboxToolsWithContext(context);
}

export type { SandboxToolContext };