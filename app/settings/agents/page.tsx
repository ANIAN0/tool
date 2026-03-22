/**
 * Agent配置管理页面
 * 用户可以管理自己的Agent配置，包括创建、编辑、删除和公开状态切换
 */

"use client";

import { useAgents, type CreateAgentInput, type UpdateAgentInput, type AgentWithTools } from "@/lib/hooks/use-agents";
import { AgentList, type AgentFormData } from "@/components/settings/agent-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * Agent配置管理页面组件
 */
export default function AgentsSettingsPage() {
  // 获取Agent列表和操作函数
  const {
    myAgents,
    publicAgents,
    isLoading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    togglePublic,
    refreshAgents,
    clearError,
  } = useAgents();

  /**
   * 处理创建Agent
   * 将表单数据转换为创建API所需的格式
   * @param data - 表单数据
   */
  const handleCreate = async (data: AgentFormData): Promise<AgentWithTools | null> => {
    // 构建创建参数
    const params: CreateAgentInput = {
      name: data.name,
      description: data.description || undefined,
      templateId: data.templateId,
      templateConfig: data.templateConfig,
      systemPrompt: data.systemPrompt || undefined,
      modelId: data.modelId || undefined,
      toolIds: data.toolIds,
    };

    // 调用创建方法
    return createAgent(params);
  };

  /**
   * 处理更新Agent
   * 将表单数据转换为更新API所需的格式
   * @param id - Agent ID
   * @param data - 表单数据
   */
  const handleUpdate = async (id: string, data: AgentFormData): Promise<boolean> => {
    // 构建更新参数
    const params: UpdateAgentInput = {
      name: data.name,
      description: data.description || null,
      templateId: data.templateId,
      templateConfig: data.templateConfig,
      systemPrompt: data.systemPrompt || null,
      modelId: data.modelId || null,
      toolIds: data.toolIds,
    };

    // 调用更新方法
    return updateAgent(id, params);
  };

  /**
   * 处理删除Agent
   * @param id - Agent ID
   */
  const handleDelete = async (id: string): Promise<boolean> => {
    return deleteAgent(id);
  };

  /**
   * 处理切换公开状态
   * @param id - Agent ID
   * @param isPublic - 目标公开状态
   */
  const handleTogglePublic = async (id: string, isPublic: boolean): Promise<boolean> => {
    return togglePublic(id, isPublic);
  };

  /**
   * 处理刷新列表
   */
  const handleRefresh = () => {
    refreshAgents();
  };

  /**
   * 处理清除错误
   */
  const handleClearError = () => {
    clearError();
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent 配置管理</h1>
        <p className="text-muted-foreground mt-1">
          创建和管理您的 AI Agent，配置模型、工具和提示词
        </p>
      </div>

      {/* 信息提示 */}
      <Alert variant="default" className="bg-muted">
        <Info className="h-4 w-4" />
        <AlertTitle>关于 Agent</AlertTitle>
        <AlertDescription>
          Agent 是具有特定功能的 AI 助手，可以配置专属的模型、工具和系统提示词。
          您可以将 Agent 设为公开，让其他用户也能使用。每个 Agent 基于一个模板运行，
          模板定义了 Agent 的执行逻辑和行为模式。
        </AlertDescription>
      </Alert>

      {/* Agent列表组件 */}
      <AgentList
        myAgents={myAgents}
        publicAgents={publicAgents}
        isLoading={isLoading}
        error={error}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onTogglePublic={handleTogglePublic}
        onRefresh={handleRefresh}
        onClearError={handleClearError}
      />
    </div>
  );
}