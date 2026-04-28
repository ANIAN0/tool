/**
 * 用户服务类型定义
 */

import type { User } from "@/lib/schemas";

/**
 * 用户服务接口
 */
export interface UserService {
  /**
   * 获取用户
   * @param id 用户ID
   * @returns 用户对象，不存在返回 null
   */
  getById(id: string): Promise<User | null>;

  /**
   * 根据用户名获取用户
   * @param username 用户名
   * @returns 用户对象，不存在返回 null
   */
  getByUsername(username: string): Promise<User | null>;

  /**
   * 获取或创建用户
   * 如果用户存在则返回，不存在则创建匿名用户
   * @param id 用户ID
   * @returns 用户记录
   */
  getOrCreate(id: string): Promise<User>;

  /**
   * 匿名用户升级为认证用户
   * @param id 用户ID
   * @param username 用户名
   * @param passwordHash 密码哈希
   * @returns 更新后的用户记录
   */
  upgradeToRegistered(
    id: string,
    username: string,
    passwordHash: string
  ): Promise<User | null>;

  /**
   * 更新用户密码
   * @param id 用户ID
   * @param passwordHash 新密码哈希
   * @returns 更新后的用户记录
   */
  updatePassword(id: string, passwordHash: string): Promise<User | null>;

  /**
   * 更新用户名
   * @param id 用户ID
   * @param username 新用户名
   * @returns 更新后的用户记录
   */
  updateUsername(id: string, username: string): Promise<User | null>;
}