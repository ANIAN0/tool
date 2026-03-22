"use client";

/**
 * AgentChat新对话页面
 * 路由 /agent-chat
 */

import { AgentChatClient } from "@/components/agent-chat";
import { nanoid } from "nanoid";
import { useMemo } from "react";

/**
 * 新对话页面组件
 */
export default function NewAgentChatPage() {
  // 预生成对话ID
  const id = useMemo(() => nanoid(), []);

  return <AgentChatClient id={id} key={id} />;
}