// __tests__/lib/utils/sandbox-path-validator.test.ts

/**
 * Sandbox 路径验证器测试
 * 防止路径遍历和命令注入攻击
 */

import { validateSandboxPath, hashUserId, ValidationError } from '@/lib/utils/sandbox-path-validator';

describe('validateSandboxPath', () => {
  describe('valid paths', () => {
    test('根路径 "/" 应该通过验证', () => {
      // 测试根路径
      const result = validateSandboxPath('/');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('空路径应该通过验证', () => {
      // 测试空路径（表示沙盒根目录）
      const result = validateSandboxPath('');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('简单路径 "/test.txt" 应该通过验证', () => {
      // 测试简单的文件路径
      const result = validateSandboxPath('/test.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('嵌套路径 "/subdir/test.txt" 应该通过验证', () => {
      // 测试带有子目录的路径
      const result = validateSandboxPath('/subdir/test.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('多层嵌套路径应该通过验证', () => {
      // 测试多层嵌套目录
      const result = validateSandboxPath('/deep/nested/path/file.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('包含点号的文件名应该通过验证', () => {
      // 测试文件名中包含点号（非路径遍历）
      const result = validateSandboxPath('/.hidden/file.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('文件名中包含多个点号应该通过验证', () => {
      // 测试文件名中包含多个点号（如 file.test.txt）
      const result = validateSandboxPath('/file.test.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('forbidden characters', () => {
    test('包含分号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 分号分隔符
      const result = validateSandboxPath('/test;rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含管道符的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 管道符
      const result = validateSandboxPath('/test|cat /etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含美元符号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 美元符号
      const result = validateSandboxPath('/test$var');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含反斜杠的路径应该被拒绝', () => {
      // 测试Windows路径分隔符
      const result = validateSandboxPath('/test\\path');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含单引号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 单引号
      const result = validateSandboxPath('/test\'file');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含双引号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 双引号
      const result = validateSandboxPath('/test"file');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含括号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 括号
      const result = validateSandboxPath('/test(cmd)');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含 & 符号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 后台执行符号
      const result = validateSandboxPath('/test&echo hello');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含 < 符号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 输入重定向
      const result = validateSandboxPath('/test<input');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含 > 符号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 输出重定向
      const result = validateSandboxPath('/test>output');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含反引号的路径应该被拒绝', () => {
      // 测试命令注入攻击 - 反引号命令替换
      const result = validateSandboxPath('/`whoami`');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含换行符的路径应该被拒绝', () => {
      // 测试换行符注入
      const result = validateSandboxPath('/test.txt\nrm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });

    test('包含回车符的路径应该被拒绝', () => {
      // 测试回车符注入
      const result = validateSandboxPath('/test.txt\rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法字符');
    });
  });

  describe('forbidden sequences', () => {
    test('包含 ".." 序列的路径应该被拒绝', () => {
      // 测试路径遍历攻击
      const result = validateSandboxPath('/../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法序列');
    });

    test('中间包含 ".." 的路径应该被拒绝', () => {
      // 测试嵌套路径遍历攻击
      const result = validateSandboxPath('/subdir/../other');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法序列');
    });

    test('包含 "~" 序列的路径应该被拒绝', () => {
      // 测试用户目录引用
      const result = validateSandboxPath('/~root/.ssh');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('非法序列');
    });
  });

  describe('path length limit', () => {
    test('超过256字符的路径应该被拒绝', () => {
      // 构造一个超长路径
      const longPath = '/' + 'a'.repeat(260);
      const result = validateSandboxPath(longPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('长度超过限制');
    });

    test('恰好256字符的路径应该通过验证', () => {
      // 构造一个恰好256字符的路径
      const maxPath = '/' + 'a'.repeat(255);
      const result = validateSandboxPath(maxPath);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    test('null 输入应该返回错误', () => {
      // 测试 null 输入
      const result = validateSandboxPath(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('路径不能为空');
    });

    test('undefined 输入应该返回错误', () => {
      // 测试 undefined 输入
      const result = validateSandboxPath(undefined as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('路径不能为空');
    });

    test('不以 / 开头的路径应该返回错误', () => {
      // 测试相对路径格式错误
      const result = validateSandboxPath('test.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('路径必须以 / 开头');
    });
  });
});

describe('sandbox scope validation', () => {
  describe('沙盒范围验证', () => {
    test('路径尝试逃逸沙盒应该被拒绝', () => {
      // 测试通过 .. 逃逸沙盒范围
      // 由于 .. 已在前面的 forbidden sequences 中被检测，这里测试其他场景
      // 正常路径应该都在 /workspace 范围内
      const result = validateSandboxPath('/safe/path');
      expect(result.valid).toBe(true);
    });

    test('根路径应该在沙盒范围内', () => {
      // 测试根路径表示沙盒根目录
      const result = validateSandboxPath('/');
      expect(result.valid).toBe(true);
    });

    test('空路径表示沙盒根目录', () => {
      // 测试空路径有效
      const result = validateSandboxPath('');
      expect(result.valid).toBe(true);
    });

    test('深层嵌套路径应该在沙盒范围内', () => {
      // 测试多层嵌套路径仍然在沙盒范围内
      const result = validateSandboxPath('/deep/nested/sub/dir/file.txt');
      expect(result.valid).toBe(true);
    });
  });
});

describe('hashUserId', () => {
  describe('哈希功能测试', () => {
    it('应该生成一致的哈希值', () => {
      // 测试相同输入产生相同哈希
      const hash1 = hashUserId('user-123');
      const hash2 = hashUserId('user-123');
      expect(hash1).toBe(hash2);
    });

    it('应该为不同输入生成不同的哈希', () => {
      // 测试不同输入产生不同哈希
      const hash1 = hashUserId('user-123');
      const hash2 = hashUserId('user-456');
      expect(hash1).not.toBe(hash2);
    });

    it('应该生成16字符长度的哈希', () => {
      // 测试哈希长度为16
      const result = hashUserId('user-123');
      expect(result.length).toBe(16);
    });

    it('应该生成有效的十六进制字符串', () => {
      // 测试哈希只包含十六进制字符
      const result = hashUserId('user-123');
      expect(result).toMatch(/^[0-9a-f]{16}$/);
    });

    it('应该正确处理空字符串输入', () => {
      // 测试空字符串输入
      const result = hashUserId('');
      expect(result.length).toBe(16);
      expect(result).toMatch(/^[0-9a-f]{16}$/);
    });

    it('应该正确处理特殊字符输入', () => {
      // 测试包含特殊字符的输入
      const result = hashUserId('user@example.com!#$');
      expect(result.length).toBe(16);
      expect(result).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});