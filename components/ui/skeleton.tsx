/**
 * Skeleton 组件
 * 骨架屏加载组件
 */

import { cn } from "@/lib/utils"

/**
 * Skeleton 组件属性
 */
interface SkeletonProps {
  className?: string
}

/**
 * Skeleton 组件
 * 用于显示加载状态的占位符
 */
function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  )
}

export { Skeleton }
