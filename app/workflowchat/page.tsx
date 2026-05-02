/**
 * WorkflowChat 新会话入口页
 * 路由 /workflowchat
 * Server Component: 验证登录，生成新会话 ID
 * Client Component: WorkflowChatClient（空状态）
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/infra/user/server";
import { WorkflowChatClient } from "@/components/workflow-chat/workflow-chat-client";
import { nanoid } from "nanoid";

/**
 * 新会话入口页
 * - Server Component: 验证登录状态，生成新会话 ID
 * - Client Component: 渲染聊天客户端
 */
export default async function WorkflowChatPage() {
  const user = await auth();

  if (!user.userId) {
    redirect("/login");
  }

  const id = nanoid();

  return <WorkflowChatClient id={id} key={id} />;
}