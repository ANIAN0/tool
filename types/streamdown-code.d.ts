/**
 * 覆盖 @streamdown/code 的类型声明
 * 该包 ESM 类型解析在 Next.js 中存在兼容问题，显式声明导出
 */

declare module "@streamdown/code" {
  export const code: unknown;
  export function createCodePlugin(options?: unknown): unknown;
}
