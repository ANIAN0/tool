"use client";

/**
 * 新对话页面
 * 路由 /chat
 * 预生成对话 ID，避免发送首条消息后创建重复对话
 */

import { ChatClient } from "@/components/chat/chat-client";
import { nanoid } from "nanoid";
import { useMemo } from "react";

/**
 * 新对话页面组件
 * 预生成对话 ID，发送首条消息时使用此 ID 创建对话
 * 使用 key 属性确保每次访问都是全新的对话
 */
export default function NewChatPage() {
  // 预生成对话 ID，在组件生命周期内保持不变
  const id = useMemo(() => nanoid(), []);

  // 将预生成的 ID 传给 ChatClient，而非 null
  return <ChatClient id={id} key={id} />;
}
