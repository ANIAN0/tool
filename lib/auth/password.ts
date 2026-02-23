import bcrypt from "bcryptjs";

// 密码加密轮数（推荐10-12）
const SALT_ROUNDS = 12;

/**
 * 加密密码
 * 使用bcrypt进行单向加密
 * @param password - 明文密码
 * @returns 加密后的密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 * 比较明文密码与哈希是否匹配
 * @param password - 明文密码
 * @param hash - 密码哈希
 * @returns 是否匹配
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 验证密码强度
 * 检查密码是否符合安全要求
 * @param password - 明文密码
 * @returns 验证结果和错误信息
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 最小长度8位
  if (password.length < 8) {
    errors.push("密码长度至少8位");
  }

  // 最大长度72位（bcrypt限制）
  if (password.length > 72) {
    errors.push("密码长度不能超过72位");
  }

  // 包含数字
  if (!/\d/.test(password)) {
    errors.push("密码必须包含数字");
  }

  // 包含字母
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("密码必须包含字母");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证用户名格式
 * @param username - 用户名
 * @returns 验证结果和错误信息
 */
export function validateUsername(username: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 长度限制
  if (username.length < 3) {
    errors.push("用户名长度至少3位");
  }

  if (username.length > 20) {
    errors.push("用户名长度不能超过20位");
  }

  // 只允许字母、数字、下划线
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push("用户名只能包含字母、数字和下划线");
  }

  // 不能以数字开头
  if (/^\d/.test(username)) {
    errors.push("用户名不能以数字开头");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
