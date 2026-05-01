/**
 * Sandbox 工具模块
 * 提供沙盒环境下的命令执行、文件读写能力
 */

import { createSandboxTools as createSandboxToolsFromModule } from '@/lib/infra/sandbox';

/**
 * 创建 Sandbox 工具（无参数版本）
 * execute 函数通过 experimental_context 获取沙盒实例
 *
 * @returns 沙盒工具集合（bash、readFile、writeFile）
 */
export function createSandboxTools() {
  return createSandboxToolsFromModule();
}