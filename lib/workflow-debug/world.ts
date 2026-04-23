/**
 * World SDK 封装层
 * 提供对 getWorld() 的统一访问，便于测试和替换
 */

import { getWorld } from '@workflow/core/runtime';
import type { World } from '@workflow/world';

/**
 * 获取 World 实例
 * 封装 workflow SDK 的 getWorld() 调用，便于在服务层中统一使用
 */
export function getDebugWorld(): World {
  return getWorld();
}