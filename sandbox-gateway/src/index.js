// sandbox-gateway/src/index.js

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { config } = require('./config');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = config.gateway.port;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API路由
app.use('/api/v1', apiRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'Sandbox Gateway',
    version: '1.0.0',
    description: 'Sandbox service gateway for Agent tools',
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    error: err.message || '内部服务器错误',
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Sandbox Gateway] 服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`[Sandbox Gateway] 用户数据目录: ${config.storage.userDataRoot}`);
  console.log(`[Sandbox Gateway] Zeroboot地址: ${config.zeroboot.url}`);
});