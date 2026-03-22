// sandbox-gateway/src/config/index.js

'use strict';

/**
 * Gateway服务配置
 * 从环境变量读取配置项
 */
const config = {
  // Gateway服务配置
  gateway: {
    port: parseInt(process.env.PORT || '8080'),
  },

  // Zeroboot配置
  zeroboot: {
    url: process.env.ZERBOOT_URL || 'http://127.0.0.1:8081',
    timeout: parseInt(process.env.ZERBOOT_TIMEOUT_MS || '60000'),
  },

  // 会话配置
  session: {
    idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || '1800000'),
  },

  // 存储配置
  storage: {
    userDataRoot: process.env.USER_DATA_ROOT || '/var/lib/zeroboot/users',
  },

  // 安全配置
  security: {
    apiKey: process.env.API_KEY || '',
    maxCodeSize: parseInt(process.env.MAX_CODE_SIZE || '1048576'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    maxStoragePerUser: parseInt(process.env.MAX_STORAGE_PER_USER || '1073741824'),
  },
};

module.exports = { config };