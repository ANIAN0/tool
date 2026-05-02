import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// 加载 .env 文件（测试环境需要）
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    environment: 'jsdom',
    // 包含源码测试和 workplace 测试目录
    include: [
      'lib/**/*.test.ts',
      'app/**/*.test.ts',
      'workplace/**/*.spec.ts',
      'workplace/**/*.test.ts',
      'workplace/**/*.test.tsx',
    ],
    // 仅排除 docs 和 node_modules，不排除 workplace
    exclude: ['docs/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/infra/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});