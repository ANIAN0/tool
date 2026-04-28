/**
 * 认证服务实现
 */

import * as jwtUtils from "./jwt";
import type { AuthService, TokenPair, JwtVerifyResult } from "./auth-types";

/**
 * 创建认证服务实例
 */
export function createAuthService(): AuthService {
  return new AuthServiceImpl();
}

/**
 * 认证服务实现类
 */
class AuthServiceImpl implements AuthService {
  /**
   * 生成令牌对
   */
  generateTokenPair(userId: string): TokenPair {
    return jwtUtils.generateTokenPair(userId);
  }

  /**
   * 验证访问令牌
   */
  verifyAccessToken(token: string): JwtVerifyResult {
    return jwtUtils.verifyAccessToken(token);
  }

  /**
   * 验证刷新令牌
   */
  verifyRefreshToken(token: string): JwtVerifyResult {
    return jwtUtils.verifyRefreshToken(token);
  }

  /**
   * 从请求头提取访问令牌
   */
  extractAccessToken(authHeader: string | null): string | null {
    return jwtUtils.extractAccessToken(authHeader);
  }

  /**
   * 检查 JWT 是否配置
   */
  isConfigured(): boolean {
    return jwtUtils.isJwtConfigured();
  }
}