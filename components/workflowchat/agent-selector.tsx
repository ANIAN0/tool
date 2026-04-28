/**
 * Agent 选择器组件
 * 用于 WorkflowChat 创建会话时选择 Agent
 *
 * 功能：
 * - 从 API 获取用户的 Agent 列表和公开 Agent
 * - 提供下拉选择器，支持分组显示
 * - 显示 Agent 名称和简要信息
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot } from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// ==================== 类型定义 ====================

/**
 * Agent 简要信息
 * 用于选择器显示
 */
export interface AgentInfo {
  // Agent ID
  id: string;
  // Agent 名称
  name: string;
  // Agent 描述
  description: string | null;
  // 是否为当前用户的 Agent
  isOwn: boolean;
  // 是否公开
  isPublic: boolean;
}

/**
 * API 返回的 Agent 数据格式
 */
interface AgentsApiResponse {
  success: boolean;
  data?: {
    // 用户自己的 Agent
    myAgents: Array<{
      id: string;
      name: string;
      description: string | null;
      is_public: boolean;
    }>;
    // 公开的 Agent（排除用户自己的）
    publicAgents: Array<{
      id: string;
      name: string;
      description: string | null;
      is_public: boolean;
      creator?: {
        id: string;
        username: string | null;
      };
    }>;
  };
  error?: string;
}

/**
 * AgentSelector 组件 Props
 */
export interface AgentSelectorProps {
  // 已选择的 Agent ID
  selectedId?: string;
  // 选择回调
  onSelect: (agentId: string) => void;
  // 是否禁用
  disabled?: boolean;
  // 是否显示加载状态（外部控制）
  loading?: boolean;
  // 占位符文本
  placeholder?: string;
  // 选择器尺寸
  size?: "sm" | "default";
}

// ==================== 组件实现 ====================

/**
 * Agent 选择器组件
 */
export function AgentSelector({
  selectedId,
  onSelect,
  disabled = false,
  loading = false,
  placeholder = "选择 Agent",
  size = "default",
}: AgentSelectorProps) {
  // Agent 列表状态
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  // 加载状态
  const [isLoading, setIsLoading] = useState(true);
  // 错误状态
  const [error, setError] = useState<string | null>(null);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 使用 authenticatedFetch 获取 Agent 列表
      const response = await authenticatedFetch("/api/agents");

      if (!response.ok) {
        // 认证错误时跳转登录页（由外部处理，这里只设置错误）
        if (response.status === 401) {
          setError("请先登录");
          return;
        }
        throw new Error(`获取 Agent 列表失败: ${response.status}`);
      }

      const data: AgentsApiResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || "获取 Agent 列表失败");
      }

      // 转换 API 数据为 AgentInfo 格式
      // 用户自己的 Agent
      const myAgents: AgentInfo[] = (data.data.myAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isOwn: true,
        isPublic: agent.is_public,
      }));

      // 公开的 Agent
      const publicAgents: AgentInfo[] = (data.data.publicAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isOwn: false,
        isPublic: true,
      }));

      // 合并列表（自己的在前，公开的在后）
      setAgents([...myAgents, ...publicAgents]);

      // 如果没有预选且列表有数据，默认选择第一个
      // 但不自动触发 onSelect，让用户主动选择
    } catch (err) {
      console.error("[AgentSelector] 加载 Agent 列表失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 组件挂载时加载 Agent 列表
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // 按 isOwn 分组
  const groupedAgents = useMemo(() => {
    const myAgents = agents.filter((a) => a.isOwn);
    const publicAgents = agents.filter((a) => !a.isOwn);
    return { myAgents, publicAgents };
  }, [agents]);

  // 获取当前选中的 Agent 信息
  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedId);
  }, [agents, selectedId]);

  // 是否正在加载
  const isCurrentlyLoading = loading || isLoading;

  // 无 Agent 时的提示
  const noAgentsMessage = !isCurrentlyLoading && agents.length === 0 && !error;

  return (
    <Select
      value={selectedId || ""}
      onValueChange={(value) => {
        if (value && value !== selectedId) {
          onSelect(value);
        }
      }}
      disabled={disabled || isCurrentlyLoading}
    >
      <SelectTrigger size={size} className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedAgent ? (
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="truncate">{selectedAgent.name}</span>
              {selectedAgent.isPublic && !selectedAgent.isOwn && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  公开
                </Badge>
              )}
            </div>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>

      <SelectContent>
        {/* 加载中状态 */}
        {isCurrentlyLoading && (
          <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载 Agent 列表…
          </div>
        )}

        {/* 错误状态 */}
        {error && !isCurrentlyLoading && (
          <div className="px-2 py-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 无 Agent 提示 */}
        {noAgentsMessage && (
          <div className="px-2 py-4 text-sm text-muted-foreground">
            暂无可用 Agent，请先
            <a href="/settings/agents" className="text-primary hover:underline ml-1">
              创建 Agent
            </a>
          </div>
        )}

        {/* Agent 列表 */}
        {!isCurrentlyLoading && !error && agents.length > 0 && (
          <>
            {/* 我的 Agent 组 */}
            {groupedAgents.myAgents.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  我的 Agent ({groupedAgents.myAgents.length})
                </SelectLabel>
                {groupedAgents.myAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {agent.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* 分隔线 */}
            {groupedAgents.myAgents.length > 0 && groupedAgents.publicAgents.length > 0 && (
              <SelectSeparator />
            )}

            {/* 公开 Agent 组 */}
            {groupedAgents.publicAgents.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs text-muted-foreground">
                  公开 Agent ({groupedAgents.publicAgents.length})
                </SelectLabel>
                {groupedAgents.publicAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {agent.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// ==================== 辅助 Hook ====================

/**
 * useAgents Hook
 * 用于获取 Agent 列表，可在其他组件复用
 */
export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch("/api/agents");

      if (!response.ok) {
        if (response.status === 401) {
          setError("请先登录");
          return;
        }
        throw new Error(`获取 Agent 列表失败: ${response.status}`);
      }

      const data: AgentsApiResponse = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || "获取 Agent 列表失败");
      }

      const myAgents: AgentInfo[] = (data.data.myAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isOwn: true,
        isPublic: agent.is_public,
      }));

      const publicAgents: AgentInfo[] = (data.data.publicAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        isOwn: false,
        isPublic: true,
      }));

      setAgents([...myAgents, ...publicAgents]);
    } catch (err) {
      console.error("[useAgents] 加载失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 自动加载
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // 按 ID 查找 Agent
  const getAgentById = useCallback(
    (id: string) => agents.find((a) => a.id === id),
    [agents]
  );

  return {
    agents,
    isLoading,
    error,
    loadAgents,
    getAgentById,
  };
}