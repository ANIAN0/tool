/**
 * 文件管理页面
 * 表格布局展示文件列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, FolderOpen } from "lucide-react";
import { FileTable, type FileEntry } from "@/components/settings/file-table";
import { FileSheet } from "@/components/settings/file-sheet";
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

  // 判断是否为匿名用户
  const isAnonymous = !isAuthenticated || user?.isAnonymous;

  // 对话列表状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // 对话加载状态
  const [conversationsLoading, setConversationsLoading] = useState(true);
  // 选中的对话 ID（用作 session ID）
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 详情抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  // 加载对话列表
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) {
      return;
    }

    const loadConversations = async () => {
      try {
        setConversationsLoading(true);
        setError(null);

        const response = await authenticatedFetch("/api/conversations");

        if (!response.ok) {
          throw new Error("获取对话列表失败");
        }

        const data = await response.json();

        // 只显示 agent-chat 来源的对话
        const agentChatConversations = (data.conversations || []).filter(
          (c: Conversation) => c.source === "agent-chat"
        );

        setConversations(agentChatConversations);

        // 默认选择最近更新的一个
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

  // 打开详情抽屉
  const handleViewFile = (file: FileEntry) => {
    setSelectedFile(file);
    setSheetOpen(true);
  };

  // 关闭详情抽屉
  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedFile(null);
  };

  // 删除成功后刷新列表
  const handleDeleteSuccess = () => {
    // FileTable 内部会自动刷新，无需额外操作
  };

  // 加载中显示骨架屏
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 匿名用户重定向
  if (isAnonymous) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">文件管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理沙盒工作区文件</p>
        </div>
      </div>

      {/* Session 选择器 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">选择对话：</label>

        {conversationsLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm text-muted-foreground">加载对话列表...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="size-4" />
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

      {/* 文件表格 */}
      {selectedSessionId && user ? (
        <FileTable
          sessionId={selectedSessionId}
          onViewFile={handleViewFile}
        />
      ) : !conversationsLoading && conversations.length === 0 ? (
        // 无对话时显示空状态
        <div className="rounded-lg border p-12 text-center">
          <FolderOpen className="size-12 mx-auto text-muted-foreground mb-4" />
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
        </div>
      ) : null}

      {/* 文件详情抽屉 */}
      {selectedSessionId && (
        <FileSheet
          file={selectedFile}
          sessionId={selectedSessionId}
          open={sheetOpen}
          onClose={handleCloseSheet}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}