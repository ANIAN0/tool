/**
 * 系统工具常量定义
 * 系统工具是平台内置能力，所有工具ID以 'system:' 开头
 */

/**
 * 系统工具ID列表
 * 所有系统工具的ID必须以 'system:' 开头
 */
export const SYSTEM_TOOL_IDS = [
  'system:sandbox:bash',
  'system:sandbox:readFile',
  'system:sandbox:writeFile',
] as const;

/**
 * 系统工具ID类型
 */
export type SystemToolId = typeof SYSTEM_TOOL_IDS[number];

/**
 * 获取所有系统工具的默认列表
 * @returns 系统工具ID数组的副本
 */
export function getDefaultSystemTools(): SystemToolId[] {
  return [...SYSTEM_TOOL_IDS];
}

/**
 * 验证并过滤有效的系统工具ID
 * @param toolIds - 待验证的工具ID列表
 * @returns 有效的系统工具ID列表
 */
export function validateSystemToolIds(toolIds: string[]): SystemToolId[] {
  return toolIds.filter((id): id is SystemToolId =>
    SYSTEM_TOOL_IDS.includes(id as SystemToolId)
  );
}

/**
 * 解析数据库中存储的系统工具JSON字符串
 * @param jsonStr - JSON字符串或null
 * @returns 系统工具ID数组，解析失败时返回默认值
 */
export function parseSystemTools(jsonStr: string | null): SystemToolId[] {
  // NULL 值返回默认值（向后兼容）
  if (!jsonStr) {
    return getDefaultSystemTools();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // 非数组类型返回默认值
    if (!Array.isArray(parsed)) {
      console.warn('enabled_system_tools 不是数组格式，使用默认值');
      return getDefaultSystemTools();
    }

    // 过滤有效的系统工具ID
    return validateSystemToolIds(parsed);
  } catch (error) {
    // JSON解析失败时返回默认值
    console.warn('解析 enabled_system_tools 失败:', error);
    return getDefaultSystemTools();
  }
}

/**
 * 序列化系统工具ID列表为JSON字符串
 * @param toolIds - 系统工具ID数组
 * @returns JSON字符串
 */
export function serializeSystemTools(toolIds: string[]): string {
  return JSON.stringify(validateSystemToolIds(toolIds));
}

/**
 * 检查是否为系统工具ID
 * @param toolId - 工具ID
 * @returns 是否为系统工具
 */
export function isSystemToolId(toolId: string): boolean {
  return toolId.startsWith('system:');
}