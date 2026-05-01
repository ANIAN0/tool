/**
 * Agent 工具创建
 * 将工具创建逻辑独立，避免循环依赖（service ↔ workflow）
 *
 * 设计目标：
 * - 在创建工具时绑定上下文（闭包方式），确保工具能正确获取沙盒信息
 * - 集中管理工具初始化和创建逻辑
 */

import type { ToolSet } from 'ai';
import { createTools, initTools } from '@/lib/infra/tools';
import { createSkillToolWithContext, type SkillToolContext } from '@/lib/infra/skills/skill-service';
import { getSandboxToolsWithContext, isSandboxEnabled, type SandboxToolContext } from '@/lib/infra/sandbox';
import { getAgentMcpRuntimeToolConfigs } from '@/lib/db/agents';
import { createAgentMcpRuntimeTools } from '@/lib/agents/mcp-runtime';
import type { AgentConfig, SkillConfig } from '@/lib/workflowchat/agent-loader';

/**
 * 检查工具名称是否为沙盒工具
 * @param toolName - 工具名称
 * @returns 是否为沙盒工具（bash、readFile、writeFile）
 */
function isSandboxTool(toolName: string): boolean {
  return ['bash', 'readFile', 'writeFile'].includes(toolName);
}

/**
 * 根据 Agent 配置创建完整的工具集合
 * 包含系统工具和 Skill 工具
 *
 * @param agentConfig - Agent 配置
 * @param userId - 用户 ID
 * @param conversationId - 会话 ID
 * @param skills - 可选的 Skill 配置列表（从 workflowInput 传入，避免重复加载）
 * @returns 工具集合（ToolSet）
 */
export async function createAgentTools(
  agentConfig: AgentConfig,
  userId: string,
  conversationId: string,
  skills?: SkillConfig[],
): Promise<ToolSet> {
  const tools: ToolSet = {};

  // 1. 根据工具配置创建系统工具实例
  if (agentConfig.tools.length > 0) {
    const toolNames = agentConfig.tools.map((tool) => tool.name);

    // 检查是否包含沙盒工具
    const hasSandboxTools = toolNames.some(isSandboxTool);

    if (hasSandboxTools) {
      // 创建沙盒工具，使用闭包绑定上下文
      // 在创建工具时注入 conversationId 和 userId
      const sandboxContext: SandboxToolContext = {
        conversationId,
        userId,
      };
      const sandboxTools = getSandboxToolsWithContext(sandboxContext);
      Object.assign(tools, sandboxTools);
      console.log("[createAgentTools] 沙盒工具创建成功:", {
        toolCount: Object.keys(sandboxTools).length,
        context: { conversationId, userId },
      });
    }

    // 创建 MCP 工具（使用 MCP 运行时）
    const mcpToolConfigs = agentConfig.tools.filter((tool) => tool.source === 'mcp');
    if (mcpToolConfigs.length > 0) {
      try {
        // 从数据库获取 Agent 绑定的 MCP 工具完整配置（含服务器信息）
        const mcpConfigs = await getAgentMcpRuntimeToolConfigs(agentConfig.id, userId);

        // 转换配置格式为 MCP 运行时所需格式
        const servers = mcpConfigs.map((c) => ({
          id: c.serverId,
          name: c.serverName,
          url: c.serverUrl,
          headers: c.serverHeaders,
          enabled: c.serverEnabled,
        }));
        const mcpToolList = mcpConfigs.map((c) => ({
          serverId: c.serverId,
          toolName: c.toolName,
        }));

        // 创建 MCP 运行时工具（best-effort，失败时降级）
        const mcpRuntime = await createAgentMcpRuntimeTools({ servers, tools: mcpToolList });
        Object.assign(tools, mcpRuntime.tools);
        console.log("[createAgentTools] MCP 工具创建成功:", {
          toolCount: Object.keys(mcpRuntime.tools).length,
          diagnostics: mcpRuntime.diagnostics.length,
        });
      } catch (error) {
        console.error("[createAgentTools] MCP 工具创建失败:", error);
      }
    }

    // 创建其他系统工具（非 sandbox、非 MCP）
    const systemToolNames = toolNames.filter(
      (name) => !isSandboxTool(name) && !mcpToolConfigs.some((t) => t.name === name)
    );
    if (systemToolNames.length > 0) {
      try {
        // 按需初始化工具定义
        initTools(systemToolNames);
        // 创建工具实例
        const result = await createTools(systemToolNames);
        Object.assign(tools, result.tools);
      } catch (error) {
        console.error("[createAgentTools] 系统工具创建失败:", error);
      }
    }
  }

  // 2. 根据 Skill 配置创建 Skill 工具实例
  // 优先使用传入的 skills 参数，避免重复从数据库加载
  const skillsToUse = skills ?? agentConfig.skills;
  if (skillsToUse.length > 0) {
    // 创建 Skill 工具，使用闭包绑定上下文
    const skillContext: SkillToolContext = {
      conversationId,
      userId,
      skills: skillsToUse,
    };
    const skillTools = createSkillToolWithContext(skillContext);
    Object.assign(tools, skillTools);
    console.log("[createAgentTools] Skill 工具创建成功:", {
      skillCount: skillsToUse.length,
      toolCount: Object.keys(skillTools).length,
      context: { conversationId, userId, skillCount: skillsToUse.length },
    });
  }

  return tools;
}