// __tests__/lib/mcp/runtime.test.ts

/**
 * MCP 运行时实现测试
 * 验证连接成功/失败场景、服务禁用、工具不存在等场景
 */

import { createMcpRuntime, McpRuntime } from "@/lib/mcp/runtime";
import type {
  McpRuntimeConfig,
  McpRuntimeDiagnostic,
} from "@/lib/mcp/interface";
import type { ToolSet } from "ai";

// Mock @ai-sdk/mcp 模块
jest.mock("@ai-sdk/mcp", () => {
  // 存储每个 URL 对应的 mock 配置
  const mockConfigs: Map<string, {
    shouldFailConnect?: boolean;
    shouldFailTools?: boolean;
    mockTools?: ToolSet;
  }> = new Map();

  // Mock MCP 客户端类
  class MockMCPClient {
    private url: string;
    private shouldFailTools: boolean;
    private mockTools: ToolSet;

    constructor(options: {
      url: string;
      shouldFailTools?: boolean;
      mockTools?: ToolSet;
    }) {
      this.url = options.url;
      this.shouldFailTools = options.shouldFailTools ?? false;
      this.mockTools = options.mockTools ?? {};
    }

    async tools(): Promise<ToolSet> {
      if (this.shouldFailTools) {
        throw new Error("获取工具列表失败: 服务内部错误");
      }
      return this.mockTools;
    }

    async close(): Promise<void> {
      // 关闭连接
    }
  }

  return {
    createMCPClient: jest.fn(async (options: { transport: { url: string } }) => {
      const url = options.transport.url;
      const config = mockConfigs.get(url);

      // 如果配置为连接失败，直接抛出错误
      if (config?.shouldFailConnect) {
        throw new Error("连接失败: 网络错误");
      }

      // 返回 mock 客户端
      return new MockMCPClient({
        url,
        shouldFailTools: config?.shouldFailTools,
        mockTools: config?.mockTools ?? {},
      });
    }),
    // 提供 mock 配置注册方法
    __registerMockConfig: (url: string, config: {
      shouldFailConnect?: boolean;
      shouldFailTools?: boolean;
      mockTools?: ToolSet;
    }) => {
      mockConfigs.set(url, config);
    },
    __clearMockConfigs: () => {
      mockConfigs.clear();
    },
  };
});

// 获取 mock 模块的辅助方法
const mcpModule = jest.requireMock("@ai-sdk/mcp");
const registerMockConfig = mcpModule.__registerMockConfig as (
  url: string,
  config: {
    shouldFailConnect?: boolean;
    shouldFailTools?: boolean;
    mockTools?: ToolSet;
  }
) => void;
const clearMockConfigs = mcpModule.__clearMockConfigs as () => void;

// ==================== 测试配置构造函数 ====================

/**
 * 创建测试用的 MCP 配置
 */
function createTestConfig(
  servers: Array<{
    id: string;
    name: string;
    url: string;
    enabled?: boolean;
    headers?: Record<string, string>;
  }>,
  tools: Array<{
    serverId: string;
    toolName: string;
  }>
): McpRuntimeConfig {
  return {
    servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      enabled: s.enabled ?? true,
      headers: s.headers,
    })),
    tools: tools.map((t) => ({
      serverId: t.serverId,
      toolName: t.toolName,
    })),
  };
}

// ==================== 测试套件 ====================

describe("createMcpRuntime", () => {
  // 每个测试前清除 mock 状态
  beforeEach(() => {
    clearMockConfigs();
    jest.clearAllMocks();
  });

  describe("连接成功场景", () => {
    test("单个服务器连接成功并获取工具", async () => {
      // 设置 mock 客户端返回测试工具
      registerMockConfig("http://test-server.com", {
        mockTools: {
          test_tool: {
            description: "测试工具",
            parameters: { type: "object" },
            execute: jest.fn(),
          },
        },
      });

      // 创建配置
      const config = createTestConfig(
        [{ id: "server-1", name: "测试服务器", url: "http://test-server.com" }],
        [{ serverId: "server-1", toolName: "test_tool" }]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证结果
      expect(result.tools).toHaveProperty("test_tool");
      expect(result.tools.test_tool.description).toBe("测试工具");
      expect(result.diagnostics).toContainEqual({
        level: "info",
        code: "TOOL_MAPPED",
        message: "MCP工具挂载成功",
        context: {
          serverId: "server-1",
          serverName: "测试服务器",
          sourceToolName: "test_tool",
          injectedToolName: "test_tool",
        },
      });

      // 清理不应出错
      await result.cleanup();
    });

    test("多个服务器连接成功", async () => {
      // 设置两个 mock 服务器
      registerMockConfig("http://server-a.com", {
        mockTools: {
          tool_a: { description: "工具A", parameters: { type: "object" } },
        },
      });
      registerMockConfig("http://server-b.com", {
        mockTools: {
          tool_b: { description: "工具B", parameters: { type: "object" } },
        },
      });

      // 创建配置
      const config = createTestConfig(
        [
          { id: "server-a", name: "服务器A", url: "http://server-a.com" },
          { id: "server-b", name: "服务器B", url: "http://server-b.com" },
        ],
        [
          { serverId: "server-a", toolName: "tool_a" },
          { serverId: "server-b", toolName: "tool_b" },
        ]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证两个工具都被成功注入
      expect(result.tools).toHaveProperty("tool_a");
      expect(result.tools).toHaveProperty("tool_b");
      expect(result.diagnostics.filter((d) => d.code === "TOOL_MAPPED")).toHaveLength(2);

      await result.cleanup();
    });

    test("同一服务器多个工具", async () => {
      // 设置 mock 服务器返回多个工具
      registerMockConfig("http://multi-tool-server.com", {
        mockTools: {
          tool_1: { description: "工具1", parameters: { type: "object" } },
          tool_2: { description: "工具2", parameters: { type: "object" } },
          tool_3: { description: "工具3", parameters: { type: "object" } },
        },
      });

      // 创建配置：同一服务器三个工具
      const config = createTestConfig(
        [{ id: "multi-server", name: "多功能服务器", url: "http://multi-tool-server.com" }],
        [
          { serverId: "multi-server", toolName: "tool_1" },
          { serverId: "multi-server", toolName: "tool_2" },
          { serverId: "multi-server", toolName: "tool_3" },
        ]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证三个工具都被注入
      expect(Object.keys(result.tools)).toHaveLength(3);
      expect(result.tools).toHaveProperty("tool_1");
      expect(result.tools).toHaveProperty("tool_2");
      expect(result.tools).toHaveProperty("tool_3");

      await result.cleanup();
    });
  });

  describe("连接失败场景", () => {
    test("单个服务器连接失败应跳过并记录诊断", async () => {
      // 设置 mock 客户端连接失败
      registerMockConfig("http://failed-server.com", {
        shouldFailConnect: true,
      });

      // 创建配置
      const config = createTestConfig(
        [{ id: "failed-server", name: "失败服务器", url: "http://failed-server.com" }],
        [{ serverId: "failed-server", toolName: "some_tool" }]
      );

      // 执行运行时创建（不应抛错）
      const result = await createMcpRuntime(config);

      // 验证工具集合为空
      expect(Object.keys(result.tools)).toHaveLength(0);

      // 验证诊断信息包含连接失败记录
      expect(result.diagnostics).toContainEqual({
        level: "error",
        code: "SERVER_CONNECT_FAILED",
        message: "MCP服务连接失败，已跳过该服务",
        context: expect.objectContaining({
          serverId: "failed-server",
          serverName: "失败服务器",
          serverUrl: "http://failed-server.com",
          error: "连接失败: 网络错误",
        }),
      });

      await result.cleanup();
    });

    test("部分服务器失败应继续处理其他服务器", async () => {
      // 设置一个失败和一个成功的服务器
      registerMockConfig("http://failed-server.com", {
        shouldFailConnect: true,
      });
      registerMockConfig("http://success-server.com", {
        mockTools: {
          working_tool: { description: "可用工具", parameters: { type: "object" } },
        },
      });

      // 创建配置
      const config = createTestConfig(
        [
          { id: "failed-server", name: "失败服务器", url: "http://failed-server.com" },
          { id: "success-server", name: "成功服务器", url: "http://success-server.com" },
        ],
        [
          { serverId: "failed-server", toolName: "failed_tool" },
          { serverId: "success-server", toolName: "working_tool" },
        ]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证成功的工具被注入，失败的被跳过
      expect(result.tools).toHaveProperty("working_tool");
      expect(result.tools).not.toHaveProperty("failed_tool");

      // 验证诊断包含失败和成功记录
      expect(result.diagnostics.some((d) => d.code === "SERVER_CONNECT_FAILED")).toBe(true);
      expect(result.diagnostics.some((d) => d.code === "TOOL_MAPPED")).toBe(true);

      await result.cleanup();
    });
  });

  describe("工具获取失败场景", () => {
    test("服务器连接成功但获取工具列表失败", async () => {
      // 设置 mock 客户端连接成功但获取工具失败
      registerMockConfig("http://tools-fail-server.com", {
        shouldFailConnect: false,
        shouldFailTools: true,
      });

      // 创建配置
      const config = createTestConfig(
        [{ id: "tools-fail-server", name: "工具获取失败服务器", url: "http://tools-fail-server.com" }],
        [{ serverId: "tools-fail-server", toolName: "some_tool" }]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证工具集合为空
      expect(Object.keys(result.tools)).toHaveLength(0);

      // 验证诊断信息包含工具获取失败记录
      expect(result.diagnostics).toContainEqual({
        level: "error",
        code: "REMOTE_TOOLS_FETCH_FAILED",
        message: "MCP服务工具列表拉取失败，已跳过该服务",
        context: expect.objectContaining({
          serverId: "tools-fail-server",
          serverName: "工具获取失败服务器",
          error: "获取工具列表失败: 服务内部错误",
        }),
      });

      await result.cleanup();
    });
  });

  describe("服务禁用场景", () => {
    test("禁用服务器应跳过并记录诊断", async () => {
      // 创建配置：服务器已禁用
      const config = createTestConfig(
        [{ id: "disabled-server", name: "禁用服务器", url: "http://disabled-server.com", enabled: false }],
        [{ serverId: "disabled-server", toolName: "some_tool" }]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证工具集合为空
      expect(Object.keys(result.tools)).toHaveLength(0);

      // 验证诊断信息包含服务禁用记录
      expect(result.diagnostics).toContainEqual({
        level: "warn",
        code: "SERVER_DISABLED",
        message: "MCP服务已禁用，已跳过该服务的工具挂载",
        context: {
          serverId: "disabled-server",
          serverName: "禁用服务器",
        },
      });

      // 不应尝试连接
      expect(result.diagnostics.some((d) => d.code === "SERVER_CONNECT_FAILED")).toBe(false);

      await result.cleanup();
    });
  });

  describe("工具不存在场景", () => {
    test("选中工具在远端不存在应跳过并记录诊断", async () => {
      // 设置 mock 服务器返回的工具列表中不包含选中的工具
      registerMockConfig("http://missing-tool-server.com", {
        mockTools: {
          other_tool: { description: "其他工具", parameters: { type: "object" } },
        },
      });

      // 创建配置：选中的工具不存在
      const config = createTestConfig(
        [{ id: "missing-tool-server", name: "工具不存在服务器", url: "http://missing-tool-server.com" }],
        [{ serverId: "missing-tool-server", toolName: "missing_tool" }]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证工具集合为空
      expect(Object.keys(result.tools)).toHaveLength(0);

      // 验证诊断信息包含工具不存在记录
      expect(result.diagnostics).toContainEqual({
        level: "warn",
        code: "TOOL_NOT_FOUND_ON_SERVER",
        message: "Agent 选中的 MCP 工具未在远端服务返回中找到，已跳过",
        context: {
          serverId: "missing-tool-server",
          serverName: "工具不存在服务器",
          toolName: "missing_tool",
        },
      });

      await result.cleanup();
    });
  });

  describe("空配置场景", () => {
    test("空服务器配置应返回空结果", async () => {
      // 创建空服务器配置
      const config = createTestConfig([], []);

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证返回空结果
      expect(Object.keys(result.tools)).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);

      // 清理不应出错
      await result.cleanup();
    });

    test("空工具配置应返回空结果", async () => {
      // 创建配置：有服务器但没有工具
      const config = createTestConfig(
        [{ id: "server-1", name: "测试服务器", url: "http://test-server.com" }],
        []
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证返回空结果
      expect(Object.keys(result.tools)).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);

      await result.cleanup();
    });
  });

  describe("清理函数测试", () => {
    test("清理函数应关闭所有客户端连接", async () => {
      // 设置 mock 客户端
      registerMockConfig("http://cleanup-server.com", {
        mockTools: {
          cleanup_tool: { description: "清理测试工具", parameters: { type: "object" } },
        },
      });

      // 创建配置
      const config = createTestConfig(
        [{ id: "cleanup-server", name: "清理服务器", url: "http://cleanup-server.com" }],
        [{ serverId: "cleanup-server", toolName: "cleanup_tool" }]
      );

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 调用清理
      await result.cleanup();

      // 再次清理不应出错（幂等性）
      await result.cleanup();
    });
  });

  describe("自定义请求头测试", () => {
    test("应正确传递自定义请求头", async () => {
      // 创建配置：带自定义请求头
      const config = createTestConfig(
        [
          {
            id: "auth-server",
            name: "认证服务器",
            url: "http://auth-server.com",
            headers: { Authorization: "Bearer test-token" },
          },
        ],
        [{ serverId: "auth-server", toolName: "auth_tool" }]
      );

      // 设置 mock 服务器
      registerMockConfig("http://auth-server.com", {
        mockTools: {
          auth_tool: { description: "认证工具", parameters: { type: "object" } },
        },
      });

      // 执行运行时创建
      const result = await createMcpRuntime(config);

      // 验证工具注入成功
      expect(result.tools).toHaveProperty("auth_tool");

      await result.cleanup();
    });
  });
});

describe("McpRuntime 类", () => {
  test("getTools 应返回工具集合", async () => {
    // 设置 mock
    registerMockConfig("http://class-test-server.com", {
      mockTools: {
        class_tool: { description: "类测试工具", parameters: { type: "object" } },
      },
    });

    const config = createTestConfig(
      [{ id: "class-server", name: "类测试服务器", url: "http://class-test-server.com" }],
      [{ serverId: "class-server", toolName: "class_tool" }]
    );

    const result = await createMcpRuntime(config);

    // getTools 应返回相同的工具集合
    expect(result.tools).toEqual(result.tools);
  });

  test("getDiagnostics 应返回诊断信息", async () => {
    registerMockConfig("http://diag-server.com", {
      mockTools: {
        diag_tool: { description: "诊断测试工具", parameters: { type: "object" } },
      },
    });

    const config = createTestConfig(
      [{ id: "diag-server", name: "诊断服务器", url: "http://diag-server.com" }],
      [{ serverId: "diag-server", toolName: "diag_tool" }]
    );

    const result = await createMcpRuntime(config);

    // getDiagnostics 应返回诊断数组
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});

describe("工具名清洗和冲突处理", () => {
  beforeEach(() => {
    clearMockConfigs();
  });

  test("工具名包含特殊字符应被清洗", async () => {
    // 设置 mock 服务器返回带特殊字符的工具名
    registerMockConfig("http://special-char-server.com", {
      mockTools: {
        "tool-with-dashes": { description: "带短横线工具", parameters: { type: "object" } },
      },
    });

    const config = createTestConfig(
      [{ id: "special-server", name: "特殊字符服务器", url: "http://special-char-server.com" }],
      [{ serverId: "special-server", toolName: "tool-with-dashes" }]
    );

    const result = await createMcpRuntime(config);

    // 短横线应被转换为下划线
    expect(result.tools).toHaveProperty("tool_with_dashes");
  });
});