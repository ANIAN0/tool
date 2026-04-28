/**
 * WorkflowChat 聊天详情页 - Server Component
 * 在服务器端验证用户身份，未登录则重定向到登录页
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/infra/user/server";
import { WorkflowChatClient } from "../_components/workflow-chat-client";

/** 路由参数类型 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * WorkflowChat 聊天详情页
 * Server Component: 验证登录状态
 * Client Component: 实际的聊天交互逻辑
 */
export default async function WorkflowChatPage({ params }: RouteParams) {
  // Server Component 登录检查
  const user = await auth();

  // 未登录则重定向到登录页
  if (!user.userId) {
    redirect("/login");
  }

  // 解析路由参数
  const { id: conversationId } = await params;

  // 已登录，渲染客户端组件并传入 userId 和 conversationId
  return <WorkflowChatClient userId={user.userId} conversationId={conversationId} />;
}