// sandbox-gateway/src/services/session.js

'use strict';

const { config } = require('../config');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');

/**
 * 会话状态存储
 * 使用Map存储所有活跃会话
 */
const sessions = new Map();

/**
 * 会话服务
 * 管理沙盒会话的生命周期
 */
class SessionService {
  constructor() {
    // 闲置超时时间（毫秒）
    this.idleTimeout = config.session.idleTimeoutMs;
    // 用户数据根目录
    this.userDataRoot = config.storage.userDataRoot;
    // 启动闲置检查定时器
    this.startIdleChecker();
  }

  /**
   * 哈希用户ID
   * 使用SHA256算法对用户ID进行哈希，取前16位
   * @param {string} userId - 原始用户ID
   * @returns {string} 哈希后的用户ID
   */
  hashUserId(userId) {
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  /**
   * 获取用户数据目录
   * @param {string} userId - 用户ID
   * @returns {string} 用户数据目录路径
   */
  getUserDir(userId) {
    return path.join(this.userDataRoot, this.hashUserId(userId));
  }

  /**
   * 获取或创建会话
   * 如果会话存在且活跃，更新活动时间并返回
   * 否则激活新会话
   * @param {string} sessionId - 会话ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 会话对象
   */
  async getOrCreate(sessionId, userId) {
    const existing = sessions.get(sessionId);

    // 如果会话存在且状态为活跃，更新活动时间并返回
    if (existing && existing.status === 'active') {
      existing.lastActivity = Date.now();
      return existing;
    }

    // 否则激活新会话
    return this.activate(sessionId, userId);
  }

  /**
   * 激活会话
   * 创建用户数据目录并初始化会话状态
   * @param {string} sessionId - 会话ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 会话对象
   */
  async activate(sessionId, userId) {
    // 准备用户数据目录
    const userDir = this.getUserDir(userId);
    await this.ensureUserDir(userDir);

    // 创建会话状态
    const session = {
      sessionId,           // 会话ID
      userId,              // 用户ID
      status: 'active',    // 会话状态
      lastActivity: Date.now(), // 最后活动时间
      userDir,             // 用户数据目录路径
    };

    // 存储会话
    sessions.set(sessionId, session);
    console.log(`[Session] Activated: ${sessionId} for user ${this.hashUserId(userId)}`);
    return session;
  }

  /**
   * 确保用户目录存在
   * 创建用户目录及workspace子目录
   * @param {string} userDir - 用户目录路径
   */
  async ensureUserDir(userDir) {
    const workspaceDir = path.join(userDir, 'workspace');
    // 递归创建目录
    await fs.mkdir(workspaceDir, { recursive: true });
  }

  /**
   * 更新会话活动时间
   * @param {string} sessionId - 会话ID
   */
  updateActivity(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * 启动闲置检查定时器
   * 每分钟检查一次所有会话，将超时的会话停用
   */
  startIdleChecker() {
    setInterval(() => {
      const now = Date.now();
      // 遍历所有会话
      for (const [id, session] of sessions) {
        // 检查活跃会话是否超时
        if (session.status === 'active' &&
            now - session.lastActivity > this.idleTimeout) {
          this.deactivate(id);
        }
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 停用会话
   * 将会话状态设置为idle
   * @param {string} sessionId - 会话ID
   */
  deactivate(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      session.status = 'idle';
      console.log(`[Session] Deactivated (idle): ${sessionId}`);
    }
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话ID
   * @returns {Object|undefined} 会话对象
   */
  getSession(sessionId) {
    return sessions.get(sessionId);
  }
}

// 单例实例
const sessionService = new SessionService();

module.exports = { sessionService, SessionService };