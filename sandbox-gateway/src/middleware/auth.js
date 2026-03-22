// sandbox-gateway/src/middleware/auth.js

'use strict';

const { config } = require('../config');

/**
 * API Key认证中间件
 * 验证请求头中的X-API-Key是否有效
 */
function authMiddleware(req, res, next) {
  // 从请求头中获取API Key
  const apiKey = req.get('X-API-Key');

  // 检查API Key是否存在
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: '缺少API Key',
      code: 'MISSING_API_KEY',
    });
  }

  // 验证API Key是否与配置中的匹配
  if (apiKey !== config.security.apiKey) {
    return res.status(401).json({
      success: false,
      error: '无效的API Key',
      code: 'INVALID_API_KEY',
    });
  }

  // 验证通过，继续下一个中间件
  next();
}

module.exports = { authMiddleware };