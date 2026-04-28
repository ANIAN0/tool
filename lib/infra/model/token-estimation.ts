/**
 * Token 估算模块
 * 使用固定系数估算 token 数量
 */

/**
 * Token估算函数（固定系数）
 * 规则：
 * - ASCII 字符：约 4 字符 = 1 token
 * - 非 ASCII 字符（中文等）：约 1.5 字符 = 1 token
 *
 * @param text 待估算的文本
 * @returns 估算的 token 数
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let asciiCount = 0;
  let nonAsciiCount = 0;

  // 统计 ASCII 和非 ASCII 字符数量
  for (const char of text) {
    if (char.charCodeAt(0) < 128) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }

  // ASCII: 4字符≈1 token, 非ASCII: 1.5字符≈1 token
  return Math.ceil(asciiCount / 4 + nonAsciiCount / 1.5);
}