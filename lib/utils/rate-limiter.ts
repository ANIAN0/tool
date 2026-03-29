/**
 * 速率限制器
 * 用于防止 API 滥用，限制每个 IP 的请求频率
 */

/**
 * 速率限制配置
 */
const RATE_LIMIT_CONFIG = {
  maxAttempts: 10,           // 每分钟最多请求次数
  windowMs: 60 * 1000,       // 时间窗口：1分钟
  lockoutThreshold: 5,       // 连续失败锁定阈值
  lockoutDuration: 15 * 60 * 1000, // 锁定时长：15分钟
};

/**
 * 速率限制条目
 */
interface RateLimitEntry {
  count: number;             // 请求计数
  firstAttempt: number;      // 首次请求时间戳
  lockedUntil?: number;      // 锁定截止时间
}

// 内存存储速率限制数据
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * 清理过期的速率限制条目，防止内存泄漏
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // 条目已过期且未锁定，或锁定已解除
    const isExpired = entry.firstAttempt < now - RATE_LIMIT_CONFIG.windowMs;
    const isLockExpired = !entry.lockedUntil || entry.lockedUntil < now;

    if (isExpired && isLockExpired) {
      rateLimitStore.delete(key);
    }
  }
}

// 每5分钟执行一次清理（仅在有定时器环境的条件下）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * 检查请求是否被允许
 *
 * @param identifier - 标识符（通常是IP地址）
 * @returns 检查结果，包含是否允许、剩余次数、是否被锁定
 */
export function checkRateLimit(
  identifier: string
): { allowed: boolean; remaining?: number; locked?: boolean } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // 检查是否被锁定
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, locked: true };
  }

  // 检查时间窗口内的请求次数
  if (entry && entry.firstAttempt > now - RATE_LIMIT_CONFIG.windowMs) {
    if (entry.count >= RATE_LIMIT_CONFIG.maxAttempts) {
      return { allowed: false, remaining: 0 };
    }
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxAttempts - entry.count };
  }

  // 新的时间窗口
  rateLimitStore.set(identifier, { count: 1, firstAttempt: now });
  return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxAttempts - 1 };
}

/**
 * 记录失败的请求
 * 连续失败达到阈值后将锁定
 *
 * @param identifier - 标识符
 */
export function recordFailure(identifier: string): void {
  const entry = rateLimitStore.get(identifier);
  if (entry) {
    entry.count++;
    // 达到锁定阈值时设置锁定
    if (entry.count >= RATE_LIMIT_CONFIG.lockoutThreshold) {
      entry.lockedUntil = Date.now() + RATE_LIMIT_CONFIG.lockoutDuration;
    }
  }
}

/**
 * 重置某个标识符的速率限制
 *
 * @param identifier - 标识符
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}