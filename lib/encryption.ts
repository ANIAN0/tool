/**
 * API Key 加密工具
 * 使用 AES-256-GCM 算法加密存储用户的 API Key
 *
 * 安全说明：
 * - 加密密钥从环境变量 ENCRYPTION_KEY 获取
 * - 密钥必须是 32 字节（256位）的 hex 字符串
 * - 使用 GCM 模式提供认证加密，防止篡改
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128位 IV
const AUTH_TAG_LENGTH = 16; // 128位认证标签
const SALT_LENGTH = 32; // 256位盐值

/**
 * 从环境变量获取加密密钥
 * 如果未设置或格式不正确，抛出错误
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY 环境变量未设置。请设置一个 32 字节（64字符hex）的密钥"
    );
  }

  // 移除可能的 0x 前缀
  const cleanKey = keyHex.replace(/^0x/, "");

  if (cleanKey.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY 必须是 32 字节（64字符hex），当前长度: ${cleanKey.length}`
    );
  }

  try {
    return Buffer.from(cleanKey, "hex");
  } catch {
    throw new Error("ENCRYPTION_KEY 必须是有效的 hex 字符串");
  }
}

/**
 * 派生加密密钥
 * 使用 scrypt 算法从主密钥和盐值派生实际加密密钥
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, 32);
}

/**
 * 加密 API Key
 *
 * @param apiKey - 要加密的 API Key 明文
 * @returns 加密后的字符串（包含盐值、IV、认证标签和密文）
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const masterKey = getEncryptionKey();

    // 生成随机盐值
    const salt = randomBytes(SALT_LENGTH);

    // 派生加密密钥
    const key = deriveKey(masterKey, salt);

    // 生成随机 IV
    const iv = randomBytes(IV_LENGTH);

    // 创建加密器
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // 加密数据
    const encrypted = Buffer.concat([
      cipher.update(apiKey, "utf8"),
      cipher.final(),
    ]);

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 组合：盐值 + IV + 认证标签 + 密文
    const result = Buffer.concat([salt, iv, authTag, encrypted]);

    // 返回 base64 编码的字符串
    return result.toString("base64");
  } catch (error) {
    console.error("加密 API Key 失败:", error);
    throw new Error("加密失败，请检查加密配置");
  }
}

/**
 * 解密 API Key
 *
 * @param encryptedData - 加密后的字符串（来自 encryptApiKey）
 * @returns 解密后的 API Key 明文
 */
export function decryptApiKey(encryptedData: string): string {
  try {
    const masterKey = getEncryptionKey();

    // 解码 base64
    const buffer = Buffer.from(encryptedData, "base64");

    // 提取各部分
    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = buffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // 派生解密密钥
    const key = deriveKey(masterKey, salt);

    // 创建解密器
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // 解密数据
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("解密 API Key 失败:", error);
    throw new Error("解密失败，数据可能已损坏或密钥不正确");
  }
}

/**
 * 生成随机加密密钥
 * 用于初始化时生成新的密钥
 *
 * @returns 64字符 hex 字符串（32字节）
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 验证加密配置是否正确
 * 检查 ENCRYPTION_KEY 是否已正确设置
 *
 * @returns 验证结果
 */
export function validateEncryptionConfig(): {
  valid: boolean;
  error?: string;
} {
  try {
    getEncryptionKey();
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
