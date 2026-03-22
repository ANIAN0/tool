// lib/sandbox/tools.ts

import { tool } from 'ai';
import { z } from 'zod';
import { getSandboxManager } from './session-manager';
import { isSandboxEnabled } from './config';

/**
 * 工具执行上下文类型
 * 通过 experimental_context 传递给工具
 */
export interface SandboxToolContext {
  conversationId: string;
  userId: string;
}

/**
 * bash工具 - 在沙盒中执行命令
 */
export const bashTool = tool({
  description: '在沙盒环境中执行bash命令。可以执行shell命令、脚本等。工作目录为用户的workspace。',
  inputSchema: z.object({
    command: z.string().describe('要执行的bash命令'),
  }),
  execute: async ({ command }, { experimental_context }) => {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      return '沙盒服务未启用，无法执行命令。';
    }

    // 从experimental_context获取会话信息
    const context = experimental_context as SandboxToolContext | undefined;

    if (!context?.conversationId || !context?.userId) {
      return '缺少会话信息，无法执行命令。';
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
        output += `\n[stderr] ${result.stderr}`;
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

/**
 * readFile工具 - 读取沙盒中的文件
 */
export const readFileTool = tool({
  description: '读取沙盒工作空间中的文件内容。路径相对于用户的workspace目录。',
  inputSchema: z.object({
    relativePath: z.string().describe('文件路径（相对于工作空间）'),
  }),
  execute: async ({ relativePath }, { experimental_context }) => {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      return '沙盒服务未启用，无法读取文件。';
    }

    // 从experimental_context获取会话信息
    const context = experimental_context as SandboxToolContext | undefined;

    if (!context?.conversationId || !context?.userId) {
      return '缺少会话信息，无法读取文件。';
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

/**
 * writeFile工具 - 写入文件到沙盒
 */
export const writeFileTool = tool({
  description: '写入文件到沙盒工作空间。如果文件不存在会自动创建，目录也会自动创建。',
  inputSchema: z.object({
    relativePath: z.string().describe('文件路径（相对于工作空间）'),
    content: z.string().describe('文件内容'),
  }),
  execute: async ({ relativePath, content }, { experimental_context }) => {
    // 检查沙盒是否启用
    if (!isSandboxEnabled()) {
      return '沙盒服务未启用，无法写入文件。';
    }

    // 从experimental_context获取会话信息
    const context = experimental_context as SandboxToolContext | undefined;

    if (!context?.conversationId || !context?.userId) {
      return '缺少会话信息，无法写入文件。';
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

/**
 * 获取所有沙盒工具
 * @returns 沙盒工具对象
 */
export function getSandboxTools() {
  if (!isSandboxEnabled()) {
    return {};
  }

  return {
    bash: bashTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
  };
}