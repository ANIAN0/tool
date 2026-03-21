/**
 * MCP服务器管理Hooks
 * 提供MCP服务器的CRUD操作和状态检查功能
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import type { McpServer, CreateMcpServerParams, UpdateMcpServerParams, McpStatusResult } from "@/lib/db/schema";

// API响应类型
interface McpServersResponse {
  servers: McpServer[];
}

interface McpServerResponse {
  server: McpServer;
}

interface McpStatusResponse {
  status: "online" | "offline" | "error";
  error?: string;
  responseTime?: number;
  tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
}

/**
 * Hook: 管理MCP服务器列表
 * 提供获取服务器列表、创建、更新、删除等功能
 */
export function useMcpServers() {
  const { getAuthHeader } = useAuth();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取MCP服务器列表
   */
  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mcp", {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取MCP服务器列表失败");
      }

      const data: McpServersResponse = await response.json();
      setServers(data.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeader]);

  /**
   * 创建新的MCP服务器
   * @param params - 创建参数
   */
  const createServer = useCallback(async (params: Omit<CreateMcpServerParams, "id" | "userId">) => {
    setError(null);

    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "创建MCP服务器失败");
      }

      const data: McpServerResponse = await response.json();
      setServers((prev) => [data.server, ...prev]);
      return data.server;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, [getAuthHeader]);

  /**
   * 更新MCP服务器
   * @param id - 服务器ID
   * @param params - 更新参数
   */
  const updateServer = useCallback(async (id: string, params: UpdateMcpServerParams) => {
    setError(null);

    try {
      const response = await fetch(`/api/mcp/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "更新MCP服务器失败");
      }

      const data: McpServerResponse = await response.json();
      setServers((prev) =>
        prev.map((server) => (server.id === id ? data.server : server))
      );
      return data.server;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, [getAuthHeader]);

  /**
   * 删除MCP服务器
   * @param id - 服务器ID
   */
  const deleteServer = useCallback(async (id: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/mcp/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除MCP服务器失败");
      }

      setServers((prev) => prev.filter((server) => server.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
      throw err;
    }
  }, [getAuthHeader]);

  /**
   * 更新单个服务器的状态（本地状态更新，不调用API）
   * @param id - 服务器ID
   * @param status - 新状态
   * @param errorMessage - 错误信息
   */
  const updateServerStatus = useCallback((id: string, status: McpServer["status"], errorMessage?: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === id
          ? { ...server, status, error_message: errorMessage || null }
          : server
      )
    );
  }, []);

  // 组件挂载时自动获取列表
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    isLoading,
    error,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    updateServerStatus,
  };
}

/**
 * Hook: 自动轮询MCP服务器状态
 * @param servers - 服务器列表
 * @param interval - 轮询间隔（毫秒），默认30秒
 */
export function useMcpServersPolling(
  servers: McpServer[],
  interval: number = 30000
) {
  const { getAuthHeader } = useAuth();
  const [serverStatuses, setServerStatuses] = useState<Record<string, McpStatusResponse>>({});
  const [isPolling, setIsPolling] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 使用 ref 存储 servers，避免依赖问题
  const serversRef = useRef(servers);

  // 同步 servers 到 ref
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  /**
   * 检查单个服务器状态
   * @param serverId - 服务器ID
   */
  const checkServerStatus = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`/api/mcp/${serverId}/status`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setServerStatuses((prev) => ({
          ...prev,
          [serverId]: { status: "error", error: data.error || "检查失败" },
        }));
        return;
      }

      const data: McpStatusResponse = await response.json();
      setServerStatuses((prev) => ({ ...prev, [serverId]: data }));
    } catch (err) {
      setServerStatuses((prev) => ({
        ...prev,
        [serverId]: {
          status: "error",
          error: err instanceof Error ? err.message : "检查失败",
        },
      }));
    }
  }, [getAuthHeader]);

  /**
   * 检查所有服务器状态
   */
  const checkAllServers = useCallback(async () => {
    // 使用 ref 而非直接依赖 servers
    const enabledServers = serversRef.current.filter((s) => s.is_enabled);

    // 并行检查所有服务器
    await Promise.all(
      enabledServers.map((server) => checkServerStatus(server.id))
    );
  }, [checkServerStatus]);

  // 设置轮询
  useEffect(() => {
    // 页面可见性变化时暂停/恢复轮询
    const handleVisibilityChange = () => {
      setIsPolling(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 初始检查
    if (serversRef.current.length > 0 && isPolling) {
      checkAllServers();
    }

    // 设置定时轮询
    if (isPolling) {
      pollingRef.current = setInterval(() => {
        if (serversRef.current.length > 0) {
          checkAllServers();
        }
      }, interval);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [interval, isPolling, checkAllServers]);

  return {
    serverStatuses,
    isPolling,
    checkServerStatus,
    checkAllServers,
  };
}

/**
 * Hook: 获取单个MCP服务器详情
 * @param serverId - 服务器ID
 */
export function useMcpServer(serverId: string | null) {
  const { getAuthHeader } = useAuth();
  const [server, setServer] = useState<McpServer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServer = useCallback(async () => {
    if (!serverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/mcp/${serverId}`, {
        headers: {
          ...getAuthHeader(),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取MCP服务器详情失败");
      }

      const data: McpServerResponse = await response.json();
      setServer(data.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [serverId, getAuthHeader]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  return { server, isLoading, error, fetchServer };
}
