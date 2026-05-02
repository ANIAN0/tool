/**
 * WorkflowChat 会话详情页
 * 路由 /workflowchat/[id]
 * Server Component: 验证登录 + 验证会话权限
 * Client Component: WorkflowChatClient（详情）
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/infra/user/server";
import { getConversationDetail } from "@/lib/workflowchat/service";
import { WorkflowChatClient } from "@/components/workflow-chat/workflow-chat-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 权限验证错误提示组件
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * 会话详情页
 * - Server Component: 验证登录状态，验证会话权限
 * - Client Component: 渲染聊天客户端
 */
export default async function WorkflowChatDetailPage({ params }: RouteParams) {
  const user = await auth();

  if (!user.userId) {
    redirect("/login");
  }

  const { id } = await params;

  // 验证会话是否存在 (T-6)
  const conversationDetail = await getConversationDetail(id);
  if (!conversationDetail) {
    return <ErrorDisplay message="会话不存在" />;
  }

  // 验证用户是否有权限访问该会话 (T-5)
  if (conversationDetail.conversation.userId !== user.userId) {
    return <ErrorDisplay message="无权访问" />;
  }

  return <WorkflowChatClient id={id} key={id} />;
}