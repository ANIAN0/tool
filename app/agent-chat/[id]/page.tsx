"use client";

/**
 * AgentChat已有对话页面
 * 动态路由 /agent-chat/[id]
 */

import { AgentChatClient } from "@/components/agent-chat";
import { use } from "react";

/**
 * 已有对话页面组件
 */
export default function AgentChatIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return <AgentChatClient id={id} key={id} />;
}