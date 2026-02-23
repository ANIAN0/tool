import jwt from "jsonwebtoken";

// JWT密钥，从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET;

// 访问令牌有效期（15分钟）
const ACCESS_TOKEN_EXPIRES_IN = "15m";

// 刷新令牌有效期（7天）
const REFRESH_TOKEN_EXPIRES_IN = "7d";

// JWT载荷类型
export interface JwtPayload {
  userId: string;
  type: "access" | "refresh";
}

// JWT验证结果类型
export interface JwtVerifyResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

/**
 * 检查JWT密钥是否配置
 */
export function isJwtConfigured(): boolean {
  return !!JWT_SECRET;
}

/**
 * 生成访问令牌
 * 有效期15分钟，用于API访问鉴权
 * @param userId - 用户ID
 * @returns JWT访问令牌
 */
export function generateAccessToken(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET环境变量未配置");
  }

  const payload: JwtPayload = {
    userId,
    type: "access",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

/**
 * 生成刷新令牌
 * 有效期7天，用于刷新访问令牌
 * @param userId - 用户ID
 * @returns JWT刷新令牌
 */
export function generateRefreshToken(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET环境变量未配置");
  }

  const payload: JwtPayload = {
    userId,
    type: "refresh",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * 验证访问令牌
 * @param token - JWT访问令牌
 * @returns 验证结果
 */
export function verifyAccessToken(token: string): JwtVerifyResult {
  if (!JWT_SECRET) {
    return { valid: false, error: "JWT_SECRET环境变量未配置" };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 确保是访问令牌
    if (decoded.type !== "access") {
      return { valid: false, error: "令牌类型错误" };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "访问令牌已过期" };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: "无效的访问令牌" };
    }
    return { valid: false, error: "令牌验证失败" };
  }
}

/**
 * 验证刷新令牌
 * @param token - JWT刷新令牌
 * @returns 验证结果
 */
export function verifyRefreshToken(token: string): JwtVerifyResult {
  if (!JWT_SECRET) {
    return { valid: false, error: "JWT_SECRET环境变量未配置" };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 确保是刷新令牌
    if (decoded.type !== "refresh") {
      return { valid: false, error: "令牌类型错误" };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "刷新令牌已过期" };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: "无效的刷新令牌" };
    }
    return { valid: false, error: "令牌验证失败" };
  }
}

/**
 * 从请求头提取访问令牌
 * @param authHeader - Authorization请求头
 * @returns 访问令牌，格式错误返回null
 */
export function extractAccessToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // 检查格式：Bearer {token}
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * 生成令牌对（访问令牌 + 刷新令牌）
 * @param userId - 用户ID
 * @returns 令牌对
 */
export function generateTokenPair(userId: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId),
  };
}
