import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // 包含源码测试和 workplace 测试目录
    include: [
      'lib/**/*.test.ts',
      'app/**/*.test.ts',
      'workplace/**/*.spec.ts',
      'workplace/**/*.test.ts',
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