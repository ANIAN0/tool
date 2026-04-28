/**
 * World SDK 封装层
 */

import { getWorld } from '@workflow/core/runtime';
import type { World } from '@workflow/world';

export function getDebugWorld(): World {
  return getWorld();
}