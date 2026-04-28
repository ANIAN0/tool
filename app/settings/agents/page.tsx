/**
 * Agent 配置管理页面
 * 表格布局展示 Agent 列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useCallback } from "react";
import { useAgents, type CreateAgentInput, type UpdateAgentInput } from "@/lib/hooks/use-agents";
import { AgentTable } from "@/components/settings/agent-table";
import { AgentSheet } from "@/components/settings/agent-sheet";
import { AgentForm, type AgentFormData } from "@/components/settings/agent-form";
import type { AgentWithTools } from "@/lib/schemas";

/**
 * Agent 配置管理页面组件
 */
export default function AgentsSettingsPage() {
  // Agent 详情抽屉状态
  const [sheetAgentId, setSheetAgentId] = useState<string | null>(null);

  // 新增/编辑表单对话框状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentWithTools | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取 Agent 列表和操作函数
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
  } = useAgents();

  /**
   * 处理查看 Agent 详情
   */
  const handleView = useCallback((agentId: string) => {
    setSheetAgentId(agentId);
  }, []);

  /**
   * 关闭详情抽屉
   */
  const handleCloseSheet = useCallback(() => {
    setSheetAgentId(null);
  }, []);

  /**
   * 处理创建 Agent
   */
  const handleCreate = useCallback(() => {
    setEditingAgent(null);
    setFormOpen(true);
  }, []);

  /**
   * 处理编辑 Agent
   */
  const handleEdit = useCallback((agentId: string) => {
    // 从 myAgents 中找到对应的 Agent
    const agent = myAgents.find((a) => a.id === agentId);
    if (agent) {
      setEditingAgent(agent);
      setFormOpen(true);
    }
  }, [myAgents]);

  /**
   * 关闭表单对话框
   */
  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    setEditingAgent(null);
  }, []);

  /**
   * 处理表单提交
   */
  const handleFormSubmit = useCallback(
    async (data: AgentFormData) => {
      setIsSubmitting(true);
      try {
        if (editingAgent) {
          // 更新现有 Agent
          const params: UpdateAgentInput = {
            name: data.name,
            description: data.description || null,
            templateId: data.templateId,
            templateConfig: data.templateConfig,
            systemPrompt: data.systemPrompt || null,
            modelId: data.modelId || null,
            toolIds: data.toolIds,
            enabledSystemTools: data.enabledSystemTools,
            skillIds: data.skillIds,
          };
          await updateAgent(editingAgent.id, params);
        } else {
          // 创建新 Agent
          const params: CreateAgentInput = {
            name: data.name,
            description: data.description || undefined,
            templateId: data.templateId,
            templateConfig: data.templateConfig,
            systemPrompt: data.systemPrompt || undefined,
            modelId: data.modelId || undefined,
            toolIds: data.toolIds,
            enabledSystemTools: data.enabledSystemTools,
            skillIds: data.skillIds,
          };
          await createAgent(params);
        }
        // 提交成功后关闭表单
        handleCloseForm();
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingAgent, createAgent, updateAgent, handleCloseForm]
  );

  /**
   * 处理删除 Agent
   */
  const handleDelete = useCallback(
    async (agentId: string) => {
      await deleteAgent(agentId);
    },
    [deleteAgent]
  );

  /**
   * 处理切换公开状态
   */
  const handleTogglePublic = useCallback(
    async (agentId: string, isPublic: boolean) => {
      await togglePublic(agentId, isPublic);
    },
    [togglePublic]
  );

  return (
    <>
      {/* Agent 表格组件 */}
      <AgentTable
        myAgents={myAgents}
        publicAgents={publicAgents}
        isLoading={isLoading}
        onRefresh={refreshAgents}
        onCreate={handleCreate}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTogglePublic={handleTogglePublic}
      />

      {/* Agent 详情抽屉 */}
      <AgentSheet
        agentId={sheetAgentId}
        open={!!sheetAgentId}
        onClose={handleCloseSheet}
        onEdit={handleEdit}
      />

      {/* 新增/编辑表单对话框 */}
      <AgentForm
        open={formOpen}
        agent={editingAgent}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        isLoading={isSubmitting}
      />
    </>
  );
}