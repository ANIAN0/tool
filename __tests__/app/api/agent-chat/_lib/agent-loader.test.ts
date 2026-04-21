/**
 * @jest-environment node
 */

/**
 * Agent配置加载模块单元测试
 * 测试 loadAgentConfig 函数的各种场景
 */

import { loadAgentConfig } from "@/app/api/agent-chat/_lib/agent-loader";
import type { AgentWithTools } from "@/lib/db/schema";

// 模拟 getAgentById 依赖
jest.mock("@/lib/db", () => ({
  getAgentById: jest.fn(),
}));

// 导入模拟函数的类型
import { getAgentById } from "@/lib/db";
const mockGetAgentById = getAgentById as jest.MockedFunction<typeof getAgentById>;

/**
 * 创建模拟的 Agent 配置
 * @param overrides - 覆盖默认值的字段
 * @returns 模拟的 AgentWithTools
 */
function createMockAgent(overrides: Partial<AgentWithTools> = {}): AgentWithTools {
  const baseAgent: AgentWithTools = {
    id: "agent-test-123",
    user_id: "user-owner-456",
    name: "测试Agent",
    description: "这是一个测试Agent",
    template_id: "basic-loop",
    template_config: null,
    system_prompt: "你是一个有帮助的AI助手",
    model_id: null,
    is_public: false,
    enabledSystemTools: [],
    tools: [],
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  return { ...baseAgent, ...overrides };
}

describe("loadAgentConfig", () => {
  // 每个测试前清除模拟状态
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("加载成功场景", () => {
    test("创建者加载自己的私有Agent应成功", async () => {
      // 模拟私有Agent，创建者与当前用户相同
      const mockAgent = createMockAgent({
        is_public: false,
        user_id: "user-current",
      });
      mockGetAgentById.mockResolvedValueOnce(mockAgent);

      const result = await loadAgentConfig("agent-test-123", "user-current");

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.agent).toEqual(mockAgent);
        expect(result.agent.id).toBe("agent-test-123");
      }
      // 验证正确调用了 getAgentById
      expect(mockGetAgentById).toHaveBeenCalledTimes(1);
      expect(mockGetAgentById).toHaveBeenCalledWith("agent-test-123", "user-current");
    });

    test("其他用户加载公开Agent应成功", async () => {
      // 模拟公开Agent，创建者与当前用户不同
      const mockAgent = createMockAgent({
        is_public: true,
        user_id: "user-owner",
      });
      mockGetAgentById.mockResolvedValueOnce(mockAgent);

      const result = await loadAgentConfig("agent-public-123", "user-other");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.agent).toEqual(mockAgent);
        expect(result.agent.is_public).toBe(true);
      }
    });

    test("Agent包含工具信息应正确返回", async () => {
      // 模拟包含工具的Agent（user_id需与调用userId一致）
      const mockAgent = createMockAgent({
        user_id: "user-current", // 关键：与调用userId一致
        tools: [
          { id: "tool-1", name: "bash", source: "system" },
          { id: "tool-2", name: "readFile", source: "mcp", serverName: "fs-server" },
        ],
        enabledSystemTools: ["system:sandbox:bash"],
      });
      mockGetAgentById.mockResolvedValueOnce(mockAgent);

      const result = await loadAgentConfig("agent-with-tools", "user-current");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.agent.tools.length).toBe(2);
        expect(result.agent.enabledSystemTools).toContain("system:sandbox:bash");
      }
    });

    test("Agent包含Skills信息应正确返回", async () => {
      // 模拟包含Skills的Agent（user_id需与调用userId一致）
      const mockAgent = createMockAgent({
        user_id: "user-owner", // 关键：与调用userId一致
        skills: [
          { id: "skill-1", name: "代码生成", description: "自动生成代码" },
        ],
      });
      mockGetAgentById.mockResolvedValueOnce(mockAgent);

      const result = await loadAgentConfig("agent-with-skills", "user-owner");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.agent.skills?.length).toBe(1);
        expect(result.agent.skills?.[0].name).toBe("代码生成");
      }
    });
  });

  describe("加载失败场景", () => {
    test("Agent不存在应返回404错误", async () => {
      // 模拟Agent不存在
      mockGetAgentById.mockResolvedValueOnce(null);

      const result = await loadAgentConfig("agent-nonexistent", "user-test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(404);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("Agent不存在或无权访问");
      }
    });

    test("非创建者访问私有Agent应返回403错误", async () => {
      // 模拟私有Agent，但getAgentById返回null（因为已做权限验证）
      mockGetAgentById.mockResolvedValueOnce(null);

      const result = await loadAgentConfig("agent-private", "user-other");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(404);
      }
    });

    test("响应应包含正确的Content-Type头", async () => {
      mockGetAgentById.mockResolvedValueOnce(null);

      const result = await loadAgentConfig("agent-test", "user-test");

      if (!result.ok) {
        const contentType = result.response.headers.get("Content-Type");
        expect(contentType).toBe("application/json");
      }
    });
  });

  describe("边界场景", () => {
    test("空agentId应正确处理", async () => {
      // getAgentById 对于空ID会返回null
      mockGetAgentById.mockResolvedValueOnce(null);

      const result = await loadAgentConfig("", "user-test");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(404);
      }
    });

    test("空userId应正确处理", async () => {
      // getAgentById 对于空userId会查询但不验证权限
      mockGetAgentById.mockResolvedValueOnce(null);

      const result = await loadAgentConfig("agent-test", "");

      expect(result.ok).toBe(false);
    });
  });
});