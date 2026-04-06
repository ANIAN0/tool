// lib/sandbox/tools.ts

import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import { getSandboxManager } from './session-manager';
import { isSandboxEnabled } from './config';

/**
 * 工具执行上下文类型
 * 包含执行沙盒工具所需的会话信息
 */
export interface SandboxToolContext {
  conversationId: string;
  userId: string;
}

/**
 * 创建bash工具 - 在沙盒中执行命令
 * @param context 工具执行上下文
 */
function createBashTool(context: SandboxToolContext) {
  return tool({
    description: '在沙盒环境中执行bash命令。可以执行shell命令、脚本等。工作目录为用户的workspace。',
    inputSchema: z.object({
      command: z.string().describe('要执行的bash命令'),
    }),
    execute: async ({ command }) => {
      // 检查沙盒是否启用
      if (!isSandboxEnabled()) {
        return '沙盒服务未启用，无法执行命令。';
      }

      try {
        const sandboxManager = getSandboxManager();
        const result = await sandboxManager.exec({
          sessionId: context.conversationId,
          userId: context.userId,
          code: command,
          language: 'bash',
        });

        // 格式化输出
        let output = '';
        if (result.stdout) {
          output += result.stdout;
        }
        if (result.stderr) {
          output += `\n${result.stderr}`; // 移除 [stderr] 前缀，保留换行
        }
        if (result.exitCode !== 0) {
          output += `\n[exit code: ${result.exitCode}]`;
        }

        return output || '命令执行完成，无输出。';
      } catch (error) {
        return `执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
  });
}

/**
 * 创建readFile工具 - 读取沙盒中的文件
 * @param context 工具执行上下文
 */
function createReadFileTool(context: SandboxToolContext) {
  return tool({
    description: '读取沙盒工作空间中的文件内容。路径相对于用户的workspace目录。',
    inputSchema: z.object({
      relativePath: z.string().describe('文件路径（相对于工作空间）'),
    }),
    execute: async ({ relativePath }) => {
      // 检查沙盒是否启用
      if (!isSandboxEnabled()) {
        return '沙盒服务未启用，无法读取文件。';
      }

      try {
        const sandboxManager = getSandboxManager();
        const content = await sandboxManager.readFile({
          sessionId: context.conversationId,
          userId: context.userId,
          relativePath,
        });

        return content;
      } catch (error) {
        return `读取失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
  });
}

/**
 * 创建writeFile工具 - 写入文件到沙盒
 * @param context 工具执行上下文
 */
function createWriteFileTool(context: SandboxToolContext) {
  return tool({
    description: '写入文件到沙盒工作空间。如果文件不存在会自动创建，目录也会自动创建。',
    inputSchema: z.object({
      relativePath: z.string().describe('文件路径（相对于工作空间）'),
      content: z.string().describe('文件内容'),
    }),
    execute: async ({ relativePath, content }) => {
      // 检查沙盒是否启用
      if (!isSandboxEnabled()) {
        return '沙盒服务未启用，无法写入文件。';
      }

      try {
        const sandboxManager = getSandboxManager();
        await sandboxManager.writeFile({
          sessionId: context.conversationId,
          userId: context.userId,
          relativePath,
          content,
        });

        return `文件 ${relativePath} 写入成功。`;
      } catch (error) {
        return `写入失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
  });
}

/**
 * 获取沙盒工具（带上下文绑定）
 * 用于 ToolLoopAgent，在创建工具时绑定会话上下文
 *
 * @param context 工具执行上下文（包含 conversationId 和 userId）
 * @returns 沙盒工具对象
 */
export function getSandboxToolsWithContext(context: SandboxToolContext): ToolSet {
  if (!isSandboxEnabled()) {
    return {};
  }

  return {
    bash: createBashTool(context),
    readFile: createReadFileTool(context),
    writeFile: createWriteFileTool(context),
  };
}

/**
 * 获取所有沙盒工具（无上下文，仅用于类型检查）
 * @deprecated 请使用 getSandboxToolsWithContext 代替
 * @returns 空对象或静态工具定义
 */
export function getSandboxTools(): ToolSet {
  if (!isSandboxEnabled()) {
    return {};
  }

  // 返回空对象，因为 ToolLoopAgent 需要在创建时绑定上下文
  // 实际使用时应调用 getSandboxToolsWithContext
  console.warn('[Sandbox] getSandboxTools() 已废弃，请使用 getSandboxToolsWithContext() 传入上下文');
  return {};
}

// 导出工具类型，供外部使用
export type { ToolSet };