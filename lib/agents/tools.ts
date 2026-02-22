/**
 * Agent工具配置模块
 * 管理不同Agent的工具
 */

import { createBashTool } from 'bash-tool';
import { tavilySearch } from '@tavily/ai-sdk';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';

/**
 * 工具类型
 */
export type ToolType = 'bash' | 'tavily' | 'mcp';

/**
 * 创建bash工具
 */
export async function createBashTools() {
  const { tools } = await createBashTool({
    files: {},
  });
  return tools;
}

/**
 * 创建Tavily搜索工具
 */
export function createTavilyTools() {
  return {
    tavilySearch: tavilySearch({
      searchDepth: 'basic',
      includeAnswer: true,
      maxResults: 5,
      topic: 'general',
    }),
  };
}

/**
 * 创建LangChain文档MCP工具的结果类型
 */
export interface MCPToolsResult {
  tools: ToolSet;
  mcpClient: MCPClient | null;
}

/**
 * 创建LangChain文档MCP工具
 * 通过HTTP连接到LangChain文档MCP服务器
 * 
 * 注意：返回的mcpClient需要在使用完毕后手动关闭
 */
export async function createLangChainMCPTools(): Promise<MCPToolsResult> {
  try {
    // 创建MCP客户端，使用HTTP传输连接到LangChain文档服务器
    const mcpClient = await createMCPClient({
      transport: {
        type: 'http',
        url: 'https://docs.langchain.com/mcp',
      },
    });

    // 获取MCP服务器提供的所有工具
    const tools = await mcpClient.tools();

    // 不关闭客户端，由调用者负责关闭
    return { tools, mcpClient };
  } catch (error) {
    console.error('创建LangChain MCP工具失败:', error);
    return { tools: {}, mcpClient: null };
  }
}

/**
 * 工具创建结果
 */
export interface ToolsCreateResult {
  tools: ToolSet;
  cleanup: () => Promise<void>;
}

/**
 * 根据工具类型创建工具对象
 * 返回工具集合和清理函数
 */
export async function createToolsByTypes(toolTypes: ToolType[]): Promise<ToolsCreateResult> {
  const tools: ToolSet = {};
  const cleanupCallbacks: Array<() => Promise<void>> = [];

  // 创建bash工具
  if (toolTypes.includes('bash')) {
    try {
      const bashTools = await createBashTools();
      Object.assign(tools, bashTools);
    } catch (error) {
      console.error('创建bash工具失败:', error);
    }
  }

  // 创建tavily工具
  if (toolTypes.includes('tavily')) {
    try {
      const tavilyTools = createTavilyTools();
      Object.assign(tools, tavilyTools);
    } catch (error) {
      console.error('创建tavily工具失败:', error);
    }
  }

  // 创建MCP工具
  if (toolTypes.includes('mcp')) {
    try {
      const { tools: mcpTools, mcpClient } = await createLangChainMCPTools();
      Object.assign(tools, mcpTools);
      // 如果MCP客户端创建成功，添加清理回调
      if (mcpClient) {
        cleanupCallbacks.push(async () => {
          await mcpClient.close();
        });
      }
    } catch (error) {
      console.error('创建MCP工具失败:', error);
    }
  }

  // 返回工具集合和清理函数
  return {
    tools,
    cleanup: async () => {
      for (const cb of cleanupCallbacks) {
        try {
          await cb();
        } catch (e) {
          console.error('工具清理失败:', e);
        }
      }
    },
  };
}
