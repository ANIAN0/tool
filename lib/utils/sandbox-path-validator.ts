// lib/utils/sandbox-path-validator.ts

/**
 * Sandbox 路径验证器
 * 防止路径遍历攻击和命令注入攻击
 */

import { createHash } from 'crypto';
import { posix as path } from 'path';

// 沙盒根路径常量
const SANDBOX_ROOT = '/workspace';

// 最大路径长度限制
const MAX_PATH_LENGTH = 256;

/**
 * 自定义验证错误类
 * 用于区分路径验证错误和其他类型错误
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 禁止字符列表（用于检测命令注入攻击）
 * 包含所有规格指定的字符
 */
const FORBIDDEN_CHARS = [';', '|', '$', '\\', "'", '"', '(', ')', '&', '<', '>', '`', '\n', '\r'];

/**
 * 非法路径序列列表（用于检测路径遍历攻击）
 */
const FORBIDDEN_SEQUENCES = ['..', '~'];

/**
 * 检查路径是否包含禁止字符（命令注入检测）
 * @param inputPath 待检查的路径
 * @returns 发现的禁止字符，如果没有则返回 null
 */
function findForbiddenChar(inputPath: string): string | null {
  // 遍历禁止字符列表，检查是否存在
  for (const char of FORBIDDEN_CHARS) {
    if (inputPath.includes(char)) {
      return char;
    }
  }
  return null;
}

/**
 * 检查路径是否包含非法序列（路径遍历检测）
 * @param inputPath 待检查的路径
 * @returns 发现的非法序列，如果没有则返回 null
 */
function findForbiddenSequence(inputPath: string): string | null {
  // 遍历非法序列列表，检查是否存在
  for (const seq of FORBIDDEN_SEQUENCES) {
    if (inputPath.includes(seq)) {
      return seq;
    }
  }
  return null;
}

/**
 * 验证沙盒路径安全性（符合规格的单参数版本）
 * 不抛出错误，返回验证结果对象
 * @param userPath 用户提供的路径
 * @returns 验证结果对象 { valid: boolean; error?: string }
 */
export function validateSandboxPath(userPath: string): { valid: boolean; error?: string } {
  // 输入类型检查
  if (userPath === null || userPath === undefined) {
    return { valid: false, error: '路径不能为空' };
  }

  // 转换为字符串（处理非字符串输入）
  const pathStr = String(userPath);

  // 路径长度检查（最大256字符）
  if (pathStr.length > MAX_PATH_LENGTH) {
    return { valid: false, error: `路径长度超过限制（最大${MAX_PATH_LENGTH}字符）` };
  }

  // 禁止字符检查（命令注入防护）
  const forbiddenChar = findForbiddenChar(pathStr);
  if (forbiddenChar) {
    // 对于不可见字符，使用转义表示
    const displayChar = forbiddenChar === '\n' ? '\\n'
                      : forbiddenChar === '\r' ? '\\r'
                      : forbiddenChar;
    return { valid: false, error: `路径包含非法字符: ${displayChar}` };
  }

  // 非法序列检查（路径遍历防护）
  const forbiddenSeq = findForbiddenSequence(pathStr);
  if (forbiddenSeq) {
    return { valid: false, error: `路径包含非法序列: ${forbiddenSeq}` };
  }

  // 绝对路径检查（必须以 / 开头或为空路径）
  // 根据规格，有效路径应该以 / 开头或者是空字符串
  // 如果不以 / 开头，则视为相对路径，但需要进一步处理

  // 空路径视为有效（表示沙盒根目录）
  if (pathStr === '' || pathStr === '/') {
    return { valid: true };
  }

  // 路径必须以 / 开头
  if (!pathStr.startsWith('/')) {
    return { valid: false, error: '路径必须以 / 开头' };
  }

  // 规范化路径后验证是否在沙盒范围内
  const normalizedPath = path.normalize(pathStr);

  // 再次检查规范化后的路径是否包含非法序列（防止编码绕过）
  const normalizedForbiddenSeq = findForbiddenSequence(normalizedPath);
  if (normalizedForbiddenSeq) {
    return { valid: false, error: `路径包含非法序列: ${normalizedForbiddenSeq}` };
  }

  // 构建完整路径，确保最终路径仍在沙盒目录内
  const fullPath = path.join(SANDBOX_ROOT, normalizedPath);

  // 验证路径是否在沙盒范围内
  if (!fullPath.startsWith(SANDBOX_ROOT)) {
    return { valid: false, error: '路径超出沙盒范围' };
  }

  return { valid: true };
}

/**
 * 对用户ID进行SHA256哈希处理
 * @param userId 用户ID字符串
 * @returns 16字符的哈希字符串（截取SHA256前16位）
 */
export function hashUserId(userId: string): string {
  // 使用 SHA256 哈希算法
  const hash = createHash('sha256');
  // 更新哈希内容
  hash.update(userId);
  // 返回十六进制格式的前16位
  return hash.digest('hex').slice(0, 16);
}
