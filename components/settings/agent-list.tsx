/**
 * Agent列表组件
 * 展示用户的Agent列表和公开的Agent列表
 */

"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { AgentCard } from "./agent-card";
import { AgentForm, type AgentFormData } from "./agent-form";
import type { AgentWithTools, PublicAgentWithCreator } from "@/lib/db/schema";

// 重新导出AgentFormData类型供外部使用
export type { AgentFormData };

/**
 * Agent列表组件属性
 */
interface AgentListProps {
  // 我的Agent列表
  myAgents: AgentWithTools[];
  // 公开Agent列表
  publicAgents: PublicAgentWithCreator[];
  // 是否加载中
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 创建Agent回调
  onCreate: (data: AgentFormData) => Promise<AgentWithTools | null>;
  // 更新Agent回调
  onUpdate: (id: string, data: AgentFormData) => Promise<boolean>;
  // 删除Agent回调
  onDelete: (id: string) => Promise<boolean>;
  // 切换公开状态回调
  onTogglePublic: (id: string, isPublic: boolean) => Promise<boolean>;
  // 刷新回调
  onRefresh: () => void;
  // 清除错误回调
  onClearError: () => void;
}

/**
 * Agent列表组件
 */
export function AgentList({
  myAgents,
  publicAgents,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onTogglePublic,
  onRefresh,
  onClearError,
}: AgentListProps) {
  // 当前选中的标签页
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  // 表单对话框状态
  const [formOpen, setFormOpen] = useState(false);
  // 当前编辑的Agent（null表示创建新Agent）
  const [editingAgent, setEditingAgent] = useState<AgentWithTools | null>(null);
  // 表单提交中状态
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 删除确认状态（存储待删除的Agent ID）
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // 删除操作中状态
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * 打开创建表单
   */
  const handleCreate = useCallback(() => {
    setEditingAgent(null);
    setFormOpen(true);
  }, []);

  /**
   * 打开编辑表单
   */
  const handleEdit = useCallback((agent: AgentWithTools) => {
    setEditingAgent(agent);
    setFormOpen(true);
  }, []);

  /**
   * 关闭表单
   */
  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    setEditingAgent(null);
  }, []);

  /**
   * 处理表单提交
   */
  const handleSubmit = useCallback(
    async (data: AgentFormData) => {
      setIsSubmitting(true);
      try {
        if (editingAgent) {
          // 更新现有Agent
          await onUpdate(editingAgent.id, data);
        } else {
          // 创建新Agent
          await onCreate(data);
        }
        // 提交成功后关闭表单
        handleCloseForm();
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingAgent, onCreate, onUpdate, handleCloseForm]
  );

  /**
   * 处理删除操作（两次点击确认机制）
   */
  const handleDelete = useCallback(
    async (id: string) => {
      // 如果不是待确认删除的ID，则进入待确认状态
      if (pendingDeleteId !== id) {
        setPendingDeleteId(id);
        return;
      }

      // 第二次点击，执行删除
      setIsDeleting(true);
      try {
        await onDelete(id);
        setPendingDeleteId(null);
      } finally {
        setIsDeleting(false);
      }
    },
    [pendingDeleteId, onDelete]
  );

  /**
   * 处理切换公开状态
   */
  const handleTogglePublic = useCallback(
    async (id: string, isPublic: boolean) => {
      await onTogglePublic(id, isPublic);
    },
    [onTogglePublic]
  );

  /**
   * 处理刷新
   */
  const handleRefresh = useCallback(() => {
    // 清除待删除状态
    setPendingDeleteId(null);
    // 调用刷新回调
    onRefresh();
  }, [onRefresh]);

  /**
   * 渲染错误提示
   */
  const renderError = () => {
    if (!error) return null;

    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearError}
            className="ml-2"
          >
            关闭
          </Button>
        </AlertDescription>
      </Alert>
    );
  };

  /**
   * 渲染加载状态
   */
  const renderLoading = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">加载中...</span>
    </div>
  );

  /**
   * 渲染空状态
   */
  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <p>{message}</p>
    </div>
  );

  /**
   * 渲染我的Agent列表
   */
  const renderMyAgents = () => {
    if (isLoading) {
      return renderLoading();
    }

    if (myAgents.length === 0) {
      return renderEmpty("暂无Agent，点击右上角\"创建\"按钮添加");
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isOwner={true}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTogglePublic={handleTogglePublic}
          />
        ))}
      </div>
    );
  };

  /**
   * 渲染公开Agent列表
   */
  const renderPublicAgents = () => {
    if (isLoading) {
      return renderLoading();
    }

    if (publicAgents.length === 0) {
      return renderEmpty("暂无公开的Agent");
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {publicAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            // 将PublicAgentWithCreator转换为AgentWithTools格式
            agent={{
              ...agent,
              user_id: agent.user_id,
            }}
            isOwner={false}
            onEdit={() => {}}
            onDelete={() => {}}
            onTogglePublic={() => {}}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 错误提示 */}
      {renderError()}

      {/* 操作按钮栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {/* 刷新按钮 */}
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* 创建按钮（始终显示，因为匿名用户不能创建Agent） */}
        <Button size="sm" onClick={handleCreate} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          创建
        </Button>
      </div>

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "public")}>
        <TabsList>
          {/* 我的Agent标签 */}
          <TabsTrigger value="my">
            我的 Agent
            {myAgents.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                {myAgents.length}
              </span>
            )}
          </TabsTrigger>

          {/* 公开Agent标签 */}
          <TabsTrigger value="public">
            公开 Agent
            {publicAgents.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                {publicAgents.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 我的Agent内容 */}
        <TabsContent value="my" className="mt-4">
          {renderMyAgents()}
        </TabsContent>

        {/* 公开Agent内容 */}
        <TabsContent value="public" className="mt-4">
          {renderPublicAgents()}
        </TabsContent>
      </Tabs>

      {/* 删除确认提示 */}
      {pendingDeleteId && (
        <Alert className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-md z-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span>再次点击删除按钮确认删除</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDeleteId(null)}
              disabled={isDeleting}
            >
              取消
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Agent表单对话框 */}
      <AgentForm
        open={formOpen}
        agent={editingAgent}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  );
}