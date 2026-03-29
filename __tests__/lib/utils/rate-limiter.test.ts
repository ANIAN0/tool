/**
 * 速率限制器单元测试
 * 测试请求频率限制功能
 */

import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/utils/rate-limiter';

describe('rate-limiter', () => {
  beforeEach(() => {
    // 每个测试前重置状态
    resetRateLimit('test-ip');
  });

  describe('checkRateLimit', () => {
    test('首次请求应该被允许', () => {
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('连续请求直到达到限制', () => {
      // 连续请求10次
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit('test-ip');
        expect(result.allowed).toBe(true);
      }
      // 第11次应该被拒绝
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('不同的标识符应该独立计数', () => {
      const result1 = checkRateLimit('ip1');
      const result2 = checkRateLimit('ip2');
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('recordFailure', () => {
    test('记录失败次数', () => {
      checkRateLimit('test-ip'); // 初始化计数
      recordFailure('test-ip');
      // 验证失败被记录（通过检查后续行为）
      // 由于内部状态，这里主要验证函数不会抛错
      expect(() => recordFailure('test-ip')).not.toThrow();
    });
  });

  describe('resetRateLimit', () => {
    test('重置后可以重新请求', () => {
      // 消耗所有请求
      for (let i = 0; i < 10; i++) {
        checkRateLimit('test-ip');
      }
      expect(checkRateLimit('test-ip').allowed).toBe(false);

      // 重置
      resetRateLimit('test-ip');

      // 应该可以再次请求
      expect(checkRateLimit('test-ip').allowed).toBe(true);
    });
  });
});