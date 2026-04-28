/**
 * 工具初始化模块
 * 预注册所有可用工具定义
 */

import { registerTool, getTool } from './registry';
import type { ToolDefinition } from './registry';

/**
 * Tavily 工具定义
 */
const tavilyToolDefinition: ToolDefinition = {
  name: 'tavily',
  description: 'Tavily 网络搜索工具',
  create: async () => {
    const { tavilySearch } = await import('@tavily/ai-sdk');
    return {
      tools: {
        tavilySearch: tavilySearch({
          searchDepth: 'basic',
          includeAnswer: true,
          maxResults: 5,
          topic: 'general',
        }),
      },
    };
  },
};

/**
 * Sandbox 工具定义
 * 沙盒工具需要外部传入 context 配置
 */
const sandboxToolDefinition: ToolDefinition = {
  name: 'sandbox',
  description: '沙盒环境工具（bash、文件读写）',
  create: async () => {
    return {
      tools: {},
    };
  },
};

/**
 * MCP 工具定义
 * MCP 工具需要外部传入配置
 */
const mcpToolDefinition: ToolDefinition = {
  name: 'mcp',
  description: 'MCP 远程工具',
  create: async () => {
    return {
      tools: {},
    };
  },
};

/**
 * 注册 Tavily 工具（仅注册，不创建）
 */
export function registerTavilyTool(): void {
  if (!getTool('tavily')) {
    registerTool(tavilyToolDefinition, 'overwrite');
  }
}

/**
 * 注册 Sandbox 工具
 */
export function registerSandboxTool(): void {
  if (!getTool('sandbox')) {
    registerTool(sandboxToolDefinition, 'overwrite');
  }
}

/**
 * 注册 MCP 工具
 */
export function registerMcpTool(): void {
  if (!getTool('mcp')) {
    registerTool(mcpToolDefinition, 'overwrite');
  }
}

/**
 * 按需初始化工具
 * 根据工具名称列表注册对应的工具定义
 * @param toolNames - 工具名称列表
 */
export function initTools(toolNames: string[]): void {
  for (const name of toolNames) {
    switch (name) {
      case 'tavily':
        registerTavilyTool();
        break;
      case 'sandbox':
        registerSandboxTool();
        break;
      case 'mcp':
        registerMcpTool();
        break;
      default:
        console.warn(`[initTools] 未知工具名称: ${name}`);
    }
  }
}

/**
 * 初始化所有内置工具
 */
export function initAllTools(): void {
  registerTavilyTool();
  registerSandboxTool();
  registerMcpTool();
}