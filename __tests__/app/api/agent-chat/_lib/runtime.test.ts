/**
 * @jest-environment node
 */

/**
 * 运行时创建模块单元测试
 * 测试 createRuntime 函数的各种场景
 */

import { createRuntime, buildSafeMcpCleanup } from "@/app/api/agent-chat/_lib/runtime";
import type { AgentWithTools } from "@/lib/db/schema";

// Mock 依赖模块
jest.mock('@/lib/sandbox', () => ({
  getSandboxToolsWithContext: jest.fn(),
}));

jest.mock('@/lib/agents/mcp-runtime', () => ({
  createAgentMcpRuntimeTools: jest.fn(),
}));

jest.mock('@/lib/agents/toolset-merge', () => ({
  mergeAgentToolSets: jest.fn(),
}));

jest.mock('@/lib/sandbox/skill-loader', () => ({
  loadSkillsToSandbox: jest.fn(),
}));

jest.mock('@/lib/sandbox/config', () => ({
  isSandboxEnabled: jest.fn(),
}));

jest.mock('@/lib/db/agents', () => ({
  getAgentSkillsInfo: jest.fn(),
}));

// 导入 mock 函数以在测试中使用
const mockGetSandboxToolsWithContext = jest.requireMock('@/lib/sandbox').getSandboxToolsWithContext;
const mockCreateAgentMcpRuntimeTools = jest.requireMock('@/lib/agents/mcp-runtime').createAgentMcpRuntimeTools;
const mockMergeAgentToolSets = jest.requireMock('@/lib/agents/toolset-merge').mergeAgentToolSets;
const mockLoadSkillsToSandbox = jest.requireMock('@/lib/sandbox/skill-loader').loadSkillsToSandbox;
const mockIsSandboxEnabled = jest.requireMock('@/lib/sandbox/config').isSandboxEnabled;
const mockGetAgentSkillsInfo = jest.requireMock('@/lib/db/agents').getAgentSkillsInfo;

/**
 * 创建模拟的 Agent 配置
 */
function createMockAgent(overrides?: Partial<AgentWithTools>): AgentWithTools {
  return {
    id: 'agent-123',
    user_id: 'user-456',
    name: 'Test Agent',
    description: 'Test agent description',
    system_prompt: 'You are a helpful assistant.',
    model_id: null,
    is_public: true,
    created_at: new Date(),
    updated_at: new Date(),
    tools: [],
    ...overrides,
  };
}

describe('createRuntime', () => {
  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    test('基本场景：无Skills、无MCP工具时应成功创建', async () => {
      // 设置 mock 返回值
      mockGetAgentSkillsInfo.mockResolvedValue([]);
      mockIsSandboxEnabled.mockReturnValue(true);
      mockGetSandboxToolsWithContext.mockReturnValue({ bash: {} as any });
      mockCreateAgentMcpRuntimeTools.mockResolvedValue({
        tools: {},
        cleanup: jest.fn(),
        diagnostics: [],
      });
      mockMergeAgentToolSets.mockReturnValue({ bash: {} as any });

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.systemPrompt).toBe('You are a helpful assistant.');
        expect(result.tools).toHaveProperty('bash');
        expect(result.mcpCleanup).not.toBeNull();
      }

      // 验证函数调用
      expect(mockGetAgentSkillsInfo).toHaveBeenCalledWith('agent-123');
      expect(mockGetSandboxToolsWithContext).toHaveBeenCalledWith({
        conversationId: 'conv-789',
        userId: 'user-456',
      });
      expect(mockCreateAgentMcpRuntimeTools).toHaveBeenCalledWith({
        agentId: 'agent-123',
        agentOwnerUserId: 'user-456',
      });
    });

    test('有Skills时应加载并合并预置提示词', async () => {
      // 设置 mock 返回值
      mockGetAgentSkillsInfo.mockResolvedValue([
        { id: 'skill-1', name: 'Test Skill', description: 'A test skill' },
      ]);
      mockIsSandboxEnabled.mockReturnValue(true);
      mockLoadSkillsToSandbox.mockResolvedValue({
        success: true,
        loadedSkills: ['skill-1'],
        skippedSkills: [],
        errors: [],
        presetPrompt: '## 已配置的 Skills\n\n以下是测试预置提示词',
      });
      mockGetSandboxToolsWithContext.mockReturnValue({ bash: {} as any });
      mockCreateAgentMcpRuntimeTools.mockResolvedValue({
        tools: {},
        cleanup: jest.fn(),
        diagnostics: [],
      });
      mockMergeAgentToolSets.mockReturnValue({ bash: {} as any });

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 系统提示词应包含预置提示词
        expect(result.systemPrompt).toContain('You are a helpful assistant.');
        expect(result.systemPrompt).toContain('已配置的 Skills');
      }

      // 验证 Skills 加载被调用
      expect(mockLoadSkillsToSandbox).toHaveBeenCalledWith('user-456', 'agent-123', 'conv-789');
    });

    test('Agent无系统提示词时应使用默认提示词', async () => {
      // 设置 mock 返回值
      mockGetAgentSkillsInfo.mockResolvedValue([]);
      mockIsSandboxEnabled.mockReturnValue(true);
      mockGetSandboxToolsWithContext.mockReturnValue({ bash: {} as any });
      mockCreateAgentMcpRuntimeTools.mockResolvedValue({
        tools: {},
        cleanup: jest.fn(),
        diagnostics: [],
      });
      mockMergeAgentToolSets.mockReturnValue({ bash: {} as any });

      // 构造参数（无系统提示词）
      const agent = createMockAgent({ system_prompt: null });
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 应使用默认提示词
        expect(result.systemPrompt).toBe('你是一个有帮助的AI助手。');
      }
    });

    test('沙盒未启用时应跳过Skills加载', async () => {
      // 设置 mock 返回值（沙盒未启用）
      mockGetAgentSkillsInfo.mockResolvedValue([
        { id: 'skill-1', name: 'Test Skill', description: 'A test skill' },
      ]);
      mockIsSandboxEnabled.mockReturnValue(false);
      mockGetSandboxToolsWithContext.mockReturnValue({});
      mockCreateAgentMcpRuntimeTools.mockResolvedValue({
        tools: {},
        cleanup: jest.fn(),
        diagnostics: [],
      });
      mockMergeAgentToolSets.mockReturnValue({});

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 系统提示词不应包含预置提示词
        expect(result.systemPrompt).toBe('You are a helpful assistant.');
      }

      // 验证 Skills 加载未被调用
      expect(mockLoadSkillsToSandbox).not.toHaveBeenCalled();
    });
  });

  describe('降级场景', () => {
    test('MCP构建失败时应降级为仅沙盒工具', async () => {
      // 设置 mock 返回值
      mockGetAgentSkillsInfo.mockResolvedValue([]);
      mockIsSandboxEnabled.mockReturnValue(true);
      mockGetSandboxToolsWithContext.mockReturnValue({ bash: {} as any });
      // MCP 构建失败
      mockCreateAgentMcpRuntimeTools.mockRejectedValue(new Error('MCP连接失败'));
      mockMergeAgentToolSets.mockReturnValue({ bash: {} as any });

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果（即使 MCP 失败，仍应返回成功）
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 应只有沙盒工具
        expect(result.tools).toHaveProperty('bash');
        // MCP 清理函数应为 null
        expect(result.mcpCleanup).toBeNull();
      }

      // 验证合并未被调用（因为 MCP 失败）
      expect(mockMergeAgentToolSets).not.toHaveBeenCalled();
    });

    test('Skills加载失败时仍应成功创建运行时', async () => {
      // 设置 mock 返回值
      mockGetAgentSkillsInfo.mockResolvedValue([
        { id: 'skill-1', name: 'Test Skill', description: 'A test skill' },
      ]);
      mockIsSandboxEnabled.mockReturnValue(true);
      // Skills 加载失败
      mockLoadSkillsToSandbox.mockResolvedValue({
        success: false,
        loadedSkills: [],
        skippedSkills: [],
        errors: [{ skillId: 'skill-1', error: '加载失败' }],
        presetPrompt: '',
      });
      mockGetSandboxToolsWithContext.mockReturnValue({ bash: {} as any });
      mockCreateAgentMcpRuntimeTools.mockResolvedValue({
        tools: {},
        cleanup: jest.fn(),
        diagnostics: [],
      });
      mockMergeAgentToolSets.mockReturnValue({ bash: {} as any });

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证成功结果（即使 Skills 加载失败，仍应成功）
      expect(result.ok).toBe(true);
      if (result.ok) {
        // 系统提示词不应包含预置提示词（因为加载失败）
        expect(result.systemPrompt).toBe('You are a helpful assistant.');
      }
    });
  });

  describe('错误场景', () => {
    test('获取Skills信息失败时应返回错误响应', async () => {
      // 设置 mock 返回值（获取 Skills 信息失败）
      mockGetAgentSkillsInfo.mockRejectedValue(new Error('数据库错误'));

      // 构造参数
      const agent = createMockAgent();
      const params = {
        agent,
        userId: 'user-456',
        conversationId: 'conv-789',
      };

      // 执行函数
      const result = await createRuntime(params);

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe('创建运行时上下文失败');
      }
    });
  });
});

describe('buildSafeMcpCleanup', () => {
  test('无清理函数时应返回空函数', async () => {
    // 构造安全清理函数（无 MCP 清理函数）
    const safeCleanup = buildSafeMcpCleanup(null);

    // 执行清理
    await safeCleanup();

    // 不应抛出错误
    expect(true).toBe(true);
  });

  test('有清理函数时应执行清理', async () => {
    // 创建 mock 清理函数
    const mockCleanup = jest.fn().mockResolvedValue(undefined);

    // 构造安全清理函数
    const safeCleanup = buildSafeMcpCleanup(mockCleanup);

    // 执行清理
    await safeCleanup();

    // 验证清理函数被调用
    expect(mockCleanup).toHaveBeenCalled();
  });

  test('清理函数失败时应不抛出错误', async () => {
    // 创建 mock 清理函数（会失败）
    const mockCleanup = jest.fn().mockRejectedValue(new Error('清理失败'));

    // 构造安全清理函数
    const safeCleanup = buildSafeMcpCleanup(mockCleanup);

    // 执行清理（不应抛出错误）
    await safeCleanup();

    // 验证清理函数被调用
    expect(mockCleanup).toHaveBeenCalled();
  });
});