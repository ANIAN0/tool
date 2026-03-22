// sandbox-gateway/src/services/exec.js

'use strict';

const axios = require('axios');
const path = require('path');
const fs = require('fs/promises');
const { config } = require('../config');
const { sessionService } = require('./session');

/**
 * Zeroboot客户端
 */
const zerobootClient = axios.create({
  baseURL: config.zeroboot.url,
  timeout: config.zeroboot.timeout,
});

/**
 * 执行服务
 * 处理代码执行和文件操作
 */
class ExecService {
  constructor() {
    this.maxCodeSize = config.security.maxCodeSize;
    this.maxFileSize = config.security.maxFileSize;
    this.maxStoragePerUser = config.security.maxStoragePerUser;
  }

  /**
   * 执行命令
   */
  async exec(sessionId, userId, code, language = 'bash') {
    // 获取或创建会话
    const session = await sessionService.getOrCreate(sessionId, userId);

    // 验证代码大小
    if (code.length > this.maxCodeSize) {
      throw new Error(`代码大小超过限制: 最大 ${this.maxCodeSize} 字节`);
    }

    // 验证语言
    const allowedLanguages = ['bash', 'python', 'node'];
    if (!allowedLanguages.includes(language)) {
      throw new Error(`不支持的语言: ${language}`);
    }

    try {
      // 构建工作目录路径
      const workdir = path.join(session.userDir, 'workspace');

      // 调用Zeroboot执行
      const response = await zerobootClient.post('/v1/exec', {
        code,
        language,
        timeout_seconds: 60,
      });

      // 更新会话活动时间
      sessionService.updateActivity(sessionId);

      return {
        success: true,
        stdout: response.data.stdout || '',
        stderr: response.data.stderr || '',
        exitCode: response.data.exit_code || 0,
        execTimeMs: response.data.exec_time_ms || 0,
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Zeroboot服务不可用');
      }
      throw error;
    }
  }

  /**
   * 读取文件
   */
  async readFile(sessionId, userId, relativePath) {
    const session = await sessionService.getOrCreate(sessionId, userId);

    // 验证路径安全性
    const filePath = this.validatePath(session.userDir, relativePath);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`文件不存在: ${relativePath}`);
    }

    // 检查文件大小
    const stats = await fs.stat(filePath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`文件太大: 最大 ${this.maxFileSize} 字节`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    sessionService.updateActivity(sessionId);

    return content;
  }

  /**
   * 写入文件
   */
  async writeFile(sessionId, userId, relativePath, content) {
    const session = await sessionService.getOrCreate(sessionId, userId);

    // 验证路径安全性
    const filePath = this.validatePath(session.userDir, relativePath);

    // 检查内容大小
    if (content.length > this.maxFileSize) {
      throw new Error(`内容太大: 最大 ${this.maxFileSize} 字节`);
    }

    // 检查用户存储配额
    await this.checkStorageQuota(session.userDir, content.length);

    // 创建目录并写入文件
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    sessionService.updateActivity(sessionId);
  }

  /**
   * 验证路径安全性
   * 防止路径遍历攻击
   */
  validatePath(userDir, relativePath) {
    // 规范化路径
    const normalizedRelative = path.normalize(relativePath);

    // 检查是否包含危险路径片段
    if (normalizedRelative.startsWith('..') || path.isAbsolute(normalizedRelative)) {
      throw new Error('无效路径: 检测到路径遍历攻击');
    }

    // 构建完整路径
    const fullPath = path.join(userDir, 'workspace', normalizedRelative);

    // 再次验证最终路径在工作空间内
    const workspaceDir = path.join(userDir, 'workspace');
    if (!fullPath.startsWith(workspaceDir)) {
      throw new Error('无效路径: 路径超出工作空间范围');
    }

    return fullPath;
  }

  /**
   * 检查存储配额
   */
  async checkStorageQuota(userDir, additionalBytes) {
    const workspaceDir = path.join(userDir, 'workspace');
    const currentSize = await this.getDirSize(workspaceDir);

    if (currentSize + additionalBytes > this.maxStoragePerUser) {
      throw new Error(`存储配额超出: 最大 ${this.maxStoragePerUser} 字节`);
    }
  }

  /**
   * 计算目录大小
   */
  async getDirSize(dirPath) {
    let size = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch {
      // 目录不存在，返回0
    }
    return size;
  }
}

const execService = new ExecService();

module.exports = { execService, ExecService };