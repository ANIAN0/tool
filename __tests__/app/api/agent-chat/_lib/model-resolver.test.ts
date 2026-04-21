/**
 * @jest-environment node
 */

/**
 * 模型解析模块单元测试
 * 测试 resolveModel 和 buildChatModelFromUserModel 函数的各种场景
 */

import { resolveModel, buildChatModelFromUserModel } from "@/app/api/agent-chat/_lib/model-resolver";
import type { UserModel } from "@/lib/db";

// 模拟数据库依赖
jest.mock("@/lib/db", () => ({
  getUserModelById: jest.fn(),
  getDefaultUserModel: jest.fn(),
}));

// 模拟加密依赖
jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn((key: string) => `decrypted-${key}`),
}));

// 模拟 AI SDK
jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn((model: string) => ({
      modelId: model,
      provider: "openai-compatible",
    })),
  })),
}));

// 导入模拟函数的类型
import { getUserModelById, getDefaultUserModel } from "@/lib/db";
import { decryptApiKey } from "@/lib/encryption";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const mockGetUserModelById = getUserModelById as jest.MockedFunction<typeof getUserModelById>;
const mockGetDefaultUserModel = getDefaultUserModel as jest.MockedFunction<typeof getDefaultUserModel>;
const mockDecryptApiKey = decryptApiKey as jest.MockedFunction<typeof decryptApiKey>;
const mockCreateOpenAICompatible = createOpenAICompatible as jest.MockedFunction<typeof createOpenAICompatible>;

/**
 * 创建模拟的用户模型配置
 * @param overrides - 覆盖默认配置的字段
 * @returns 模拟的 UserModel
 */
function createMockUserModel(overrides: Partial<UserModel> = {}): UserModel {
  return {
    id: "model-123",
    user_id: "user-123",
    name: "测试模型",
    provider: "openai",
    model: "gpt-4",
    api_key: "encrypted-api-key",
    base_url: "https://api.openai.com/v1",
    is_default: true,
    context_limit: 32000,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

describe("resolveModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Agent 绑定模型场景", () => {
    test("Agent 绑定了模型，应使用创建者的模型池", async () => {
      // 模拟 Agent 创建者的模型配置
      const agentOwnerModel = createMockUserModel({
        id: "model-agent",
        user_id: "agent-owner",
        model: "gpt-4-turbo",
      });
      mockGetUserModelById.mockResolvedValueOnce(agentOwnerModel);

      // 调用 resolveModel（Agent 绑定了模型）
      const result = await resolveModel("agent-owner", "model-agent", "current-user");

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.modelName).toBe("gpt-4-turbo");
        expect(result.contextLimit).toBe(32000);
        expect(result.userModel).toEqual(agentOwnerModel);
      }

      // 验证查询的是 Agent 创建者的模型池
      expect(mockGetUserModelById).toHaveBeenCalledWith("agent-owner", "model-agent");
      // 不应查询用户默认模型
      expect(mockGetDefaultUserModel).not.toHaveBeenCalled();
    });

    test("Agent 绑定的模型不存在，应返回400错误", async () => {
      // 模拟模型不存在
      mockGetUserModelById.mockResolvedValueOnce(null);

      const result = await resolveModel("agent-owner", "model-not-exist", "current-user");

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("Agent关联的模型不存在");
      }
    });
  });

  describe("Agent 未绑定模型场景", () => {
    test("Agent 未绑定模型，应使用当前用户的默认模型", async () => {
      // 模拟用户默认模型配置
      const userDefaultModel = createMockUserModel({
        id: "model-default",
        user_id: "current-user",
        model: "gpt-3.5-turbo",
        context_limit: 16000,
      });
      mockGetDefaultUserModel.mockResolvedValueOnce(userDefaultModel);

      // 调用 resolveModel（Agent 未绑定模型，agentModelId 为 null）
      const result = await resolveModel("agent-owner", null, "current-user");

      // 验证成功结果
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.modelName).toBe("gpt-3.5-turbo");
        expect(result.contextLimit).toBe(16000);
        expect(result.userModel).toEqual(userDefaultModel);
      }

      // 验证查询了用户的默认模型
      expect(mockGetDefaultUserModel).toHaveBeenCalledWith("current-user");
      // 不应查询 Agent 创建者的模型池
      expect(mockGetUserModelById).not.toHaveBeenCalled();
    });

    test("用户未配置默认模型，应返回400错误", async () => {
      // 模拟用户没有默认模型
      mockGetDefaultUserModel.mockResolvedValueOnce(null);

      const result = await resolveModel("agent-owner", null, "current-user");

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("请先在设置页配置并设为默认模型（OpenAI-Compatible）");
      }
    });
  });

  describe("模型构建错误场景", () => {
    test("provider 不是 openai，应返回错误响应", async () => {
      // 模拟非 openai provider 的模型配置
      const invalidModel = createMockUserModel({
        provider: "anthropic", // 不支持的 provider
      });
      mockGetUserModelById.mockResolvedValueOnce(invalidModel);

      const result = await resolveModel("agent-owner", "model-invalid", "current-user");

      // 验证失败结果
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(400);
        const errorBody = await result.response.json();
        expect(errorBody.error).toBe("当前仅支持 OpenAI-Compatible（provider=openai）");
      }
    });
  });

  describe("响应格式验证", () => {
    test("错误响应应包含正确的 Content-Type 头", async () => {
      mockGetUserModelById.mockResolvedValueOnce(null);

      const result = await resolveModel("agent-owner", "model-not-exist", "current-user");

      if (!result.ok) {
        const contentType = result.response.headers.get("Content-Type");
        expect(contentType).toBe("application/json");
      }
    });
  });
});

describe("buildChatModelFromUserModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("应正确解密 API Key", () => {
    const userModel = createMockUserModel({
      api_key: "encrypted-test-key",
    });

    buildChatModelFromUserModel(userModel);

    // 验证调用了解密函数
    expect(mockDecryptApiKey).toHaveBeenCalledWith("encrypted-test-key");
  });

  test("应使用自定义 base_url", () => {
    const userModel = createMockUserModel({
      base_url: "https://custom.api.example.com/v1",
    });

    buildChatModelFromUserModel(userModel);

    // 验证使用了自定义 base_url
    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://custom.api.example.com/v1",
      })
    );
  });

  test("base_url 为 null 时应使用默认 OpenAI 端点", () => {
    const userModel = createMockUserModel({
      base_url: null,
    });

    buildChatModelFromUserModel(userModel);

    // 验证使用了默认端点
    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.openai.com/v1",
      })
    );
  });

  test("provider 不是 openai 时应抛出错误", () => {
    const userModel = createMockUserModel({
      provider: "anthropic",
    });

    expect(() => buildChatModelFromUserModel(userModel)).toThrow(
      "当前仅支持 OpenAI-Compatible（provider=openai）"
    );
  });

  test("应使用正确的模型名称创建聊天模型", () => {
    const userModel = createMockUserModel({
      model: "gpt-4o-mini",
    });

    const chatModel = buildChatModelFromUserModel(userModel);

    // 验证创建了正确的模型
    expect(chatModel.modelId).toBe("gpt-4o-mini");
  });
});