// sandbox-gateway/src/routes/api.js

'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { execService } = require('../services/exec');
const { sessionService } = require('../services/session');

// 所有路由需要认证
router.use(authMiddleware);

/**
 * POST /api/v1/sessions/:sessionId/exec
 * 执行命令
 */
router.post('/sessions/:sessionId/exec', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, code, language } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: userId, code',
      });
    }

    const result = await execService.exec(sessionId, userId, code, language);
    res.json(result);
  } catch (error) {
    console.error('[API] Exec error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/sessions/:sessionId/read
 * 读取文件
 */
router.post('/sessions/:sessionId/read', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, path: relativePath } = req.body;

    if (!userId || !relativePath) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: userId, path',
      });
    }

    const content = await execService.readFile(sessionId, userId, relativePath);
    res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error('[API] Read error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/sessions/:sessionId/write
 * 写入文件
 */
router.post('/sessions/:sessionId/write', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, path: relativePath, content } = req.body;

    if (!userId || !relativePath || content === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: userId, path, content',
      });
    }

    await execService.writeFile(sessionId, userId, relativePath, content);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Write error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/sessions/:sessionId/heartbeat
 * 发送心跳
 */
router.post('/sessions/:sessionId/heartbeat', (req, res) => {
  const { sessionId } = req.params;
  sessionService.updateActivity(sessionId);
  res.json({ success: true });
});

/**
 * GET /api/v1/sessions/:sessionId/status
 * 查询会话状态
 */
router.get('/sessions/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;
  const session = sessionService.getSession(sessionId);

  if (!session) {
    return res.json({
      status: 'not_found',
      lastActivity: 0,
    });
  }

  res.json({
    status: session.status,
    lastActivity: session.lastActivity,
  });
});

module.exports = router;