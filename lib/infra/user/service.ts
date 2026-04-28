/**
 * 用户服务实现
 */

import * as dbUsers from "@/lib/db/users";
import type { User } from "@/lib/schemas";
import type { UserService } from "./types";

/**
 * 创建用户服务实例
 */
export function createUserService(): UserService {
  return new UserServiceImpl();
}

/**
 * 用户服务实现类
 */
class UserServiceImpl implements UserService {
  /**
   * 获取用户
   */
  async getById(id: string): Promise<User | null> {
    return dbUsers.getUserById(id);
  }

  /**
   * 根据用户名获取用户
   */
  async getByUsername(username: string): Promise<User | null> {
    return dbUsers.getUserByUsername(username);
  }

  /**
   * 创建注册用户
   */
  async create(id: string, username: string, passwordHash: string): Promise<User> {
    return dbUsers.createUser(id, username, passwordHash);
  }

  /**
   * 更新用户密码
   */
  async updatePassword(id: string, passwordHash: string): Promise<User | null> {
    return dbUsers.updateUserPassword(id, passwordHash);
  }

  /**
   * 更新用户名
   */
  async updateUsername(id: string, username: string): Promise<User | null> {
    return dbUsers.updateUsername(id, username);
  }
}