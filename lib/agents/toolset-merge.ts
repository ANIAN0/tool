import type { ToolSet } from "ai";

/**
 * 合并 Agent 运行时工具集合
 * 规则：系统工具优先，MCP 工具仅补充缺失键
 */
export function mergeAgentToolSets(params: {
  systemTools: ToolSet;
  mcpTools: ToolSet;
}): ToolSet {
  // 读取系统工具集合（如 sandbox）
  const { systemTools, mcpTools } = params;
  // 先复制系统工具，保证系统工具名称与行为不被覆盖
  const mergedTools: ToolSet = { ...systemTools };

  // 再逐个挂载 MCP 工具（通常已是 mcp__ 前缀命名）
  for (const [toolName, tool] of Object.entries(mcpTools)) {
    // 若出现重名，跳过 MCP 同名工具并保留系统工具
    if (toolName in mergedTools) {
      continue;
    }
    // 将 MCP 工具注入最终工具集合
    mergedTools[toolName] = tool;
  }

  // 返回合并后的工具集合
  return mergedTools;
}
