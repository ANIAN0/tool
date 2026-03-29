/**
 * 文件管理页面
 * 查看和管理沙盒工作区文件
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, FolderOpen, Loader2, AlertCircle } from "lucide-react";
import { FileManager } from "@/components/settings/file-manager";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// 对话数据类型定义
interface Conversation {
  id: string;
  title: string | null;
  agent_id: string;
  source: string;
  created_at: number;
  updated_at: number;
}

export default function FilesSettingsPage() {
  const { isLoading, user, isAuthenticated } = useAuth();

  // 判断是否为匿名用户（未登录或用户标记为匿名）
  const isAnonymous = !isAuthenticated || user?.isAnonymous;

  // 对话列表状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // 对话加载状态
  const [conversationsLoading, setConversationsLoading] = useState(true);
  // 选中的对话 ID（用作 session ID）
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 加载对话列表
  useEffect(() => {
    // 如果正在加载认证状态或用户未登录，不执行
    if (isLoading || !isAuthenticated || !user) {
      return;
    }

    const loadConversations = async () => {
      try {
        setConversationsLoading(true);
        setError(null);

        // 使用认证请求获取对话列表
        const response = await authenticatedFetch("/api/conversations");

        if (!response.ok) {
          throw new Error("获取对话列表失败");
        }

        const data = await response.json();

        // 只显示 agent-chat 来源的对话（因为只有这些对话有沙盒 session）
        const agentChatConversations = (data.conversations || []).filter(
          (c: Conversation) => c.source === "agent-chat"
        );

        setConversations(agentChatConversations);

        // 如果有对话，默认选择最近更新的一个
        if (agentChatConversations.length > 0) {
          setSelectedSessionId(agentChatConversations[0].id);
        }
      } catch (err) {
        console.error("加载对话列表失败:", err);
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setConversationsLoading(false);
      }
    };

    loadConversations();
  }, [isLoading, isAuthenticated, user]);

  // 加载中显示骨架屏
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 匿名用户重定向到首页
  if (isAnonymous) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">文件管理</h1>
        <p className="text-muted-foreground mt-1">
          查看和管理您的沙盒工作区文件
        </p>
      </div>

      {/* 信息提示 */}
      <Alert variant="default" className="bg-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>关于文件管理</AlertTitle>
        <AlertDescription>
          沙盒工作区是 Agent 执行任务的隔离环境，每个对话对应一个独立的沙盒会话。
          Skill 文件存储在 <code className="text-blue-600">skills/</code> 目录下，
          Agent 执行过程中创建的文件也会保存在沙盒中。
        </AlertDescription>
      </Alert>

      {/* 对话选择器 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">选择对话：</label>

        {conversationsLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">加载对话列表...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              重试
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            暂无对话，请先在 Agent Chat 页面创建对话
          </span>
        ) : (
          <Select
            value={selectedSessionId || ""}
            onValueChange={(value) => setSelectedSessionId(value)}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="选择一个对话" />
            </SelectTrigger>
            <SelectContent>
              {conversations.map((conv) => (
                <SelectItem key={conv.id} value={conv.id}>
                  {conv.title || `对话 ${conv.id.slice(0, 8)}`}
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 文件管理组件 */}
      {selectedSessionId && user ? (
        <FileManager userId={user.id} sessionId={selectedSessionId} />
      ) : !conversationsLoading && conversations.length === 0 ? (
        // 无对话时显示空状态
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              请先在 Agent Chat 页面创建对话，然后在此查看沙盒文件
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => (window.location.href = "/agent-chat")}
            >
              前往 Agent Chat
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}