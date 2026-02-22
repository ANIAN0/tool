"use client";

/**
 * 已有对话页面
 * 动态路由 /chat/[id]
 * 使用 key 属性确保对话切换时组件重新挂载
 */

import { ChatClient } from "@/components/chat/chat-client";
import { use } from "react";

/**
 * 已有对话页面组件
 * 使用 React use() hook 解析 params
 * 从 URL 获取对话 ID 并传给 ChatClient
 */
export default function ChatIdPage({ params }: { params: Promise<{ id: string }> }) {
  // 使用 use() hook 解析 Promise 类型的 params（Next.js 15+）
  const { id } = use(params);

  // 使用 id 作为 key，确保切换对话时组件重新挂载
  return <ChatClient id={id} key={id} />;
}
