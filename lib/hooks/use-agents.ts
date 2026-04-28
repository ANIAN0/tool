/**
 * Agent 管理 Hook
 * 提供 Agent 配置的 CRUD 操作和公开状态管理
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import type {
  Agent,
  AgentWithTools,
  PublicAgentWithCreator,
  CreateAgentParams,
  UpdateAgentParams,
} from "@/lib/schemas";

// ==================== 类型定义 ====================

/**
 * API 响应：Agent 列表
 */
interface AgentsListResponse {
  success: boolean;
  data: {
    myAgents: AgentWithTools[];
    publicAgents: PublicAgentWithCreator[];
  };
}

/**
 * API 响应：单个 Agent
 */
interface AgentResponse {
  success: boolean;
  data: AgentWithTools;
}

/**
 * 创建 Agent 的参数（前端使用）
 * 与 schema 中的 CreateAgentParams 对应，但不需要 id 和 userId
 */
export interface CreateAgentInput {
  name: string;
  description?: string;
  templateId: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string;
  modelId?: string;
  toolIds?: string[];
  // 启用的系统工具ID列表
  enabledSystemTools?: string[];
  // 关联的 Skill ID 列表
  skillIds?: string[];
}

/**
 * 更新 Agent 的参数（前端使用）
 */
export interface UpdateAgentInput {
  name?: string;
  description?: string | null;
  templateId?: string;
  templateConfig?: Record<string, unknown>;
  systemPrompt?: string | null;
  modelId?: string | null;
  toolIds?: string[];
  // 启用的系统工具ID列表
  enabledSystemTools?: string[];
  // 关联的 Skill ID 列表
  skillIds?: string[];
}

/**
 * useAgents Hook 返回类型
 */
export interface UseAgentsReturn {
  // 我的 Agent 列表
  myAgents: AgentWithTools[];
  // 公开 Agent 列表
  publicAgents: PublicAgentWithCreator[];
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;

  // 操作方法
  fetchAgents: () => Promise<void>;
  createAgent: (params: CreateAgentInput) => Promise<AgentWithTools | null>;
  updateAgent: (id: string, params: UpdateAgentInput) => Promise<boolean>;
  deleteAgent: (id: string) => Promise<boolean>;
  togglePublic: (id: string, isPublic: boolean) => Promise<boolean>;
  refreshAgents: () => Promise<void>;
  clearError: () => void;
}

// ==================== Hook 实现 ====================

/**
 * Agent 管理 Hook
 *
 * @returns Agent 管理方法和状态
 *
 * @example
 * ```tsx
 * const {
 *   myAgents,
 *   publicAgents,
 *   isLoading,
 *   createAgent,
 *   updateAgent,
 *   deleteAgent,
 *   togglePublic,
 * } = useAgents();
 * ```
 */
export function useAgents(): UseAgentsReturn {
  // 获取认证状态
  const { isAuthenticated, getAuthHeader } = useAuth();

  // 状态定义
  const [myAgents, setMyAgents] = useState<AgentWithTools[]>([]);
  const [publicAgents, setPublicAgents] = useState<PublicAgentWithCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取 Agent 列表
   * 同时获取我的 Agent 和公开 Agent
   */
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 调用 Agent 列表 API
      const response = await fetch("/api/agents", {
        headers: {
          ...getAuthHeader(),
        },
      });

      const data: AgentsListResponse = await response.json();

      // 检查响应状态
      if (!response.ok || !data.success) {
        throw new Error((data as { error?: string }).error || "获取 Agent 列表失败");
      }

      // 更新状态（添加防御性检查，确保始终是数组）
      setMyAgents(Array.isArray(data.data?.myAgents) ? data.data.myAgents : []);
      setPublicAgents(Array.isArray(data.data?.publicAgents) ? data.data.publicAgents : []);
    } catch (err) {
      // 设置错误信息
      setError(err instanceof Error ? err.message : "获取 Agent 列表失败");
      console.error("获取 Agent 列表失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeader]);

  /**
   * 创建新 Agent
   * @param params - 创建参数
   * @returns 创建成功的 Agent 或 null
   */
  const createAgent = useCallback(
    async (params: CreateAgentInput): Promise<AgentWithTools | null> => {
      setError(null);

      try {
        // 调用创建 API
        const response = await fetch("/api/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(params),
        });

        const data: AgentResponse = await response.json();

        // 检查响应状态
        if (!response.ok || !data.success) {
          throw new Error((data as { error?: string }).error || "创建 Agent 失败");
        }

        // 将新 Agent 添加到列表头部
        setMyAgents((prev) => [data.data, ...prev]);

        return data.data;
      } catch (err) {
        // 设置错误信息
        setError(err instanceof Error ? err.message : "创建 Agent 失败");
        console.error("创建 Agent 失败:", err);
        return null;
      }
    },
    [getAuthHeader]
  );

  /**
   * 更新 Agent
   * @param id - Agent ID
   * @param params - 更新参数
   * @returns 是否更新成功
   */
  const updateAgent = useCallback(
    async (id: string, params: UpdateAgentInput): Promise<boolean> => {
      setError(null);

      try {
        // 调用更新 API
        const response = await fetch(`/api/agents/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(params),
        });

        const data: AgentResponse = await response.json();

        // 检查响应状态
        if (!response.ok || !data.success) {
          throw new Error((data as { error?: string }).error || "更新 Agent 失败");
        }

        // 更新本地列表中的 Agent
        setMyAgents((prev) =>
          prev.map((agent) => (agent.id === id ? data.data : agent))
        );

        // 如果 Agent 变为公开，更新公开列表
        if (data.data.is_public) {
          // 更新公开列表中的该 Agent（如果已存在）
          setPublicAgents((prev) => {
            const existingIndex = prev.findIndex((a) => a.id === id);
            if (existingIndex >= 0) {
              // 更新现有的公开 Agent
              const updated = [...prev];
              updated[existingIndex] = data.data as PublicAgentWithCreator;
              return updated;
            } else {
              // 添加新的公开 Agent
              return [...prev, data.data as PublicAgentWithCreator];
            }
          });
        } else {
          // 如果 Agent 变为私有，从公开列表中移除
          setPublicAgents((prev) => prev.filter((a) => a.id !== id));
        }

        return true;
      } catch (err) {
        // 设置错误信息
        setError(err instanceof Error ? err.message : "更新 Agent 失败");
        console.error("更新 Agent 失败:", err);
        return false;
      }
    },
    [getAuthHeader]
  );

  /**
   * 删除 Agent
   * @param id - Agent ID
   * @returns 是否删除成功
   */
  const deleteAgent = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);

      try {
        // 调用删除 API
        const response = await fetch(`/api/agents/${id}`, {
          method: "DELETE",
          headers: {
            ...getAuthHeader(),
          },
        });

        const data = await response.json();

        // 检查响应状态
        if (!response.ok || !data.success) {
          throw new Error(data.error || "删除 Agent 失败");
        }

        // 从本地列表中移除
        setMyAgents((prev) => prev.filter((agent) => agent.id !== id));
        // 同时从公开列表中移除（如果存在）
        setPublicAgents((prev) => prev.filter((agent) => agent.id !== id));

        return true;
      } catch (err) {
        // 设置错误信息
        setError(err instanceof Error ? err.message : "删除 Agent 失败");
        console.error("删除 Agent 失败:", err);
        return false;
      }
    },
    [getAuthHeader]
  );

  /**
   * 切换 Agent 公开状态
   * @param id - Agent ID
   * @param isPublic - 目标公开状态
   * @returns 是否操作成功
   */
  const togglePublic = useCallback(
    async (id: string, isPublic: boolean): Promise<boolean> => {
      setError(null);

      try {
        // 调用公开状态切换 API
        const response = await fetch(`/api/agents/${id}/publish`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ isPublic }),
        });

        const data: AgentResponse = await response.json();

        // 检查响应状态
        if (!response.ok || !data.success) {
          throw new Error((data as { error?: string }).error || "切换公开状态失败");
        }

        // 更新我的 Agent 列表中的公开状态
        setMyAgents((prev) =>
          prev.map((agent) =>
            agent.id === id
              ? { ...agent, is_public: data.data.is_public }
              : agent
          )
        );

        // 更新公开列表
        if (data.data.is_public) {
          // 添加到公开列表
          setPublicAgents((prev) => {
            // 避免重复添加
            if (prev.some((a) => a.id === id)) {
              return prev.map((a) => (a.id === id ? (data.data as PublicAgentWithCreator) : a));
            }
            return [...prev, data.data as PublicAgentWithCreator];
          });
        } else {
          // 从公开列表移除
          setPublicAgents((prev) => prev.filter((a) => a.id !== id));
        }

        return true;
      } catch (err) {
        // 设置错误信息
        setError(err instanceof Error ? err.message : "切换公开状态失败");
        console.error("切换公开状态失败:", err);
        return false;
      }
    },
    [getAuthHeader]
  );

  /**
   * 手动刷新 Agent 列表
   */
  const refreshAgents = useCallback(async () => {
    await fetchAgents();
  }, [fetchAgents]);

  /**
   * 清除错误状态
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 组件挂载时自动获取列表
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    myAgents,
    publicAgents,
    isLoading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    togglePublic,
    refreshAgents,
    clearError,
  };
}

// ==================== 辅助类型导出 ====================

// 重新导出 schema 中的类型，方便使用
export type { AgentWithTools, PublicAgentWithCreator, CreateAgentParams, UpdateAgentParams };