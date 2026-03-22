/**
 * 工具管理Hooks
 * 提供统一工具列表获取和筛选功能
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "./use-auth";
import type { Tool } from "@/lib/db/schema";

// API响应类型
interface ToolsResponse {
  tools: Tool[];
  stats: {
    total: number;
    system: number;
    mcp: number;
    available: number;
  };
}

/**
 * 工具筛选选项
 */
export interface ToolFilter {
  // 按来源筛选
  source?: "all" | "system" | "mcp";
  // 按可用性筛选
  availability?: "all" | "available" | "unavailable";
  // 搜索关键词
  searchQuery?: string;
}

/**
 * Hook: 管理工具列表
 * 提供获取工具列表、筛选等功能
 */
export function useTools() {
  const { getAuthHeader } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [stats, setStats] = useState<ToolsResponse["stats"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取所有工具列表
   */
  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tools", {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取工具列表失败");
      }

      const data: ToolsResponse = await response.json();
      setTools(data.tools);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeader]);

  // 组件挂载时自动获取列表
  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {
    tools,
    stats,
    isLoading,
    error,
    fetchTools,
  };
}

/**
 * Hook: 工具筛选
 * @param tools - 工具列表
 * @param filter - 筛选条件
 */
export function useToolFiltering(tools: Tool[], filter: ToolFilter) {
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // 按来源筛选
      if (filter.source && filter.source !== "all") {
        if (tool.source !== filter.source) {
          return false;
        }
      }

      // 按可用性筛选
      if (filter.availability && filter.availability !== "all") {
        if (filter.availability === "available" && !tool.isAvailable) {
          return false;
        }
        if (filter.availability === "unavailable" && tool.isAvailable) {
          return false;
        }
      }

      // 按搜索关键词筛选
      if (filter.searchQuery && filter.searchQuery.trim() !== "") {
        const query = filter.searchQuery.toLowerCase().trim();
        const nameMatch = tool.name.toLowerCase().includes(query);
        const descMatch = tool.description?.toLowerCase().includes(query);
        if (!nameMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [tools, filter]);

  // 分组统计
  const groups = useMemo(() => {
    const systemTools = filteredTools.filter((t) => t.source === "system");
    const mcpTools = filteredTools.filter((t) => t.source === "mcp");

    return {
      system: {
        tools: systemTools,
        count: systemTools.length,
        available: systemTools.filter((t) => t.isAvailable).length,
      },
      mcp: {
        tools: mcpTools,
        count: mcpTools.length,
        available: mcpTools.filter((t) => t.isAvailable).length,
      },
    };
  }, [filteredTools]);

  return {
    filteredTools,
    groups,
    count: filteredTools.length,
  };
}

/**
 * Hook: 获取MCP服务器工具列表
 * @param serverId - MCP服务器ID
 */
export function useMcpServerTools(serverId: string | null) {
  const { getAuthHeader } = useAuth();
  const [tools, setTools] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown> | null;
  }>>([]);
  const [server, setServer] = useState<{ id: string; name: string; status: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    if (!serverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/mcp/${serverId}/tools`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取MCP工具列表失败");
      }

      const data = await response.json();
      setServer(data.server);

      // 解析工具列表中的JSON Schema
      const parsedTools = data.tools.map((tool: {
        id: string;
        name: string;
        description: string | null;
        input_schema: string | null;
      }) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema ? JSON.parse(tool.input_schema) : null,
      }));

      setTools(parsedTools);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [serverId, getAuthHeader]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return { tools, server, isLoading, error, fetchTools };
}

/**
 * 获取工具图标（基于工具名称或ID）
 * @param tool - 工具对象
 * @returns 图标名称或emoji
 */
export function getToolIcon(tool: Tool): string {
  // MCP工具使用通用图标
  return "🔌";
}

/**
 * 获取工具状态标签
 * @param tool - 工具对象
 * @returns 状态标签文本
 */
export function getToolStatusLabel(tool: Tool): { text: string; color: string } {
  if (tool.isAvailable) {
    return { text: "可用", color: "bg-blue-100 text-blue-800" };
  }

  return { text: "不可用", color: "bg-gray-100 text-gray-600" };
}
