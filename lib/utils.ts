/**
 * 工具函数库
 * 提供通用的工具函数，简化开发过程
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { nanoid } from "nanoid"

/**
 * 生成唯一ID
 * 使用nanoid生成短且唯一的字符串ID
 *
 * @param length - ID长度，默认为12
 * @returns 唯一ID字符串
 */
export function generateId(length: number = 12): string {
  return nanoid(length)
}

/**
 * 合并并优化Tailwind CSS类名
 * 使用clsx合并类名，然后使用tailwind-merge去重和优化
 * 
 * @param inputs - 类名输入（支持字符串、数组、对象等多种格式）
 * @returns 优化后的类名字符串
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <div className={cn("text-red-500", "font-bold")} />
 * 
 * // 条件渲染
 * <div className={cn("text-red-500", isActive && "font-bold")} />
 * 
 * // 复杂条件
 * <div className={cn("text-red-500", { "font-bold": isActive, "italic": isItalic })} />
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
