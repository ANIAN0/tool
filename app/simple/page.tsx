/**
 * SimpleEditor 演示页面
 * 展示 TipTap 富文本编辑器功能
 */

"use client";

import dynamic from "next/dynamic";

// 🚀 性能优化：动态导入 SimpleEditor，减少初始 bundle 大小约 100KB
const SimpleEditor = dynamic(
  () =>
    import("@/components/tiptap-templates/simple/simple-editor").then(
      (m) => m.SimpleEditor
    ),
  {
    ssr: false, // 富文本编辑器不需要 SSR
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          加载编辑器...
        </div>
      </div>
    ),
  }
);

export default function Page() {
  return <SimpleEditor />;
}