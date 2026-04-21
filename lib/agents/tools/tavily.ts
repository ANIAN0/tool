/**
 * Tavily搜索工具模块
 * 提供网络搜索能力
 */

import { tavilySearch } from '@tavily/ai-sdk';

/**
 * 创建Tavily搜索工具
 * 配置基础搜索深度、包含答案、最大结果数等参数
 */
export function createTavilyTools() {
  return {
    tavilySearch: tavilySearch({
      searchDepth: 'basic', // 基础搜索深度
      includeAnswer: true, // 包含AI生成的答案
      maxResults: 5, // 最大返回结果数
      topic: 'general', // 通用主题搜索
    }),
  };
}