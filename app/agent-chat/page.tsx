/**
 * AgentChat新对话页面
 * 路由 /agent-chat
 */

"use client";

import dynamic from "next/dynamic";
import { nanoid } from "nanoid";
import { useMemo } from "react";

// 🚀 性能优化：动态导入 AgentChatClient，减少初始 bundle 大小
const AgentChatClient = dynamic(
  () =>
    import("@/components/agent-chat/agent-chat-client").then(
      (m) => m.AgentChatClient
    ),
  {
    ssr: false, // 禁用 SSR，减少服务端渲染时间
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    ),
  }
);

/**
 * 新对话页面组件
 */
export default function NewAgentChatPage() {
  // 预生成对话ID
  const id = useMemo(() => nanoid(), []);

  return <AgentChatClient id={id} key={id} />;
}