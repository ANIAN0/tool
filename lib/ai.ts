import { wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";

/**
 * 是否启用DevTools
 * 仅在开发环境下启用
 */
const isDevToolsEnabled = process.env.NODE_ENV === "development";

/**
 * 包装语言模型，添加DevTools中间件
 * 用于调试LLM请求、响应及工具调用过程
 * 
 * @param model - 原始语言模型实例
 * @returns 包装后的语言模型实例（开发环境添加DevTools中间件）
 * 
 * @example
 * ```ts
 * import { gateway } from 'ai';
 * import { wrapModelWithDevTools } from '@/lib/ai';
 * 
 * const model = wrapModelWithDevTools(gateway('anthropic/claude-sonnet-4.5'));
 * ```
 */
export function wrapModelWithDevTools<T extends Parameters<typeof wrapLanguageModel>[0]["model"]>(
  model: T
): T {
  // 非开发环境直接返回原始模型
  if (!isDevToolsEnabled) {
    return model;
  }

  // 使用DevTools中间件包装模型
  return wrapLanguageModel({
    middleware: devToolsMiddleware(),
    model,
  }) as T;
}
