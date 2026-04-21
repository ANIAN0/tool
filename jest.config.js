const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  // 使用 node 环境测试 Node.js API 相关代码
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/docs/',  // docs 目录使用 vitest
  ],
  // 转换 ESM 模块，避免 "Cannot use import statement outside a module" 错误
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!nanoid|@ai-sdk|ai|@vercel)/',
  ],
}

module.exports = createJestConfig(customJestConfig)