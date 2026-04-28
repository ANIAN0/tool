/**
 * 认证服务类型定义
 */

import type { User } from "@/lib/schemas";

/**
 * 认证服务接口
 */
export interface AuthService {
  /**
   * 生成令牌对
   * @param userId 用户ID
   * @returns 令牌对（访问令牌 + 刷新令牌）
   */
  generateTokenPair(userId: string): TokenPair;

  /**
   * 验证访问令牌
   * @param token JWT访问令牌
   * @returns 验证结果
   */
  verifyAccessToken(token: string): JwtVerifyResult;

  /**
   * 验证刷新令牌
   * @param token JWT刷新令牌
   * @returns 验证结果
   */
  verifyRefreshToken(token: string): JwtVerifyResult;

  /**
   * 从请求头提取访问令牌
   * @param authHeader Authorization请求头
   * @returns 访问令牌
   */
  extractAccessToken(authHeader: string | null): string | null;

  /**
   * 检查 JWT 是否配置
   */
  isConfigured(): boolean;
}

/**
 * 令牌对类型
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT 载荷类型
 */
export interface JwtPayload {
  userId: string;
  type: "access" | "refresh";
}

/**
 * JWT 验证结果类型
 */
export interface JwtVerifyResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}