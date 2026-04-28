/**
 * WorkflowChat 会话列表页 - Server Component
 * 在服务器端验证用户身份，未登录则重定向到登录页
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/infra/user/server";
import { WorkflowChatListClient } from "./_components/workflow-chat-list-client";

/**
 * WorkflowChat 会话列表页
 * Server Component: 验证登录状态
 * Client Component: 实际的页面交互逻辑
 */
export default async function WorkflowChatListPage() {
  // Server Component 登录检查
  const user = await auth();

  // 未登录则重定向到登录页
  if (!user.userId) {
    redirect("/login");
  }

  // 已登录，渲染客户端组件并传入 userId
  return <WorkflowChatListClient userId={user.userId} />;
}