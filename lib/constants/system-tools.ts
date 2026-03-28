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

/**
 * 系统工具元数据类型
 * 用于 API 返回的工具列表项
 */
export interface SystemToolMeta {
  // 工具唯一标识，以 'system:' 开头
  id: string;
  // 工具名称（不含前缀）
  name: string;
  // 工具描述
  description: string;
  // 工具输入参数的 JSON Schema
  inputSchema: Record<string, unknown>;
  // 工具来源标识
  source: 'system';
  // 工具是否可用（系统工具始终为 true）
  isAvailable: boolean;
}

/**
 * 系统工具元数据列表
 * 用于 /api/tools 返回系统工具信息
 */
export const SYSTEM_TOOLS_META: SystemToolMeta[] = [
  {
    id: 'system:sandbox:bash',
    name: 'bash',
    description: '在沙盒环境中执行bash命令。可以执行shell命令、脚本等。',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的bash命令' },
      },
      required: ['command'],
    },
    source: 'system',
    isAvailable: true,
  },
  {
    id: 'system:sandbox:readFile',
    name: 'readFile',
    description: '读取沙盒工作空间中的文件内容。路径相对于用户的workspace目录。',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', description: '文件路径（相对于工作空间）' },
      },
      required: ['relativePath'],
    },
    source: 'system',
    isAvailable: true,
  },
  {
    id: 'system:sandbox:writeFile',
    name: 'writeFile',
    description: '写入文件到沙盒工作空间。如果文件不存在会自动创建，目录也会自动创建。',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: { type: 'string', description: '文件路径（相对于工作空间）' },
        content: { type: 'string', description: '文件内容' },
      },
      required: ['relativePath', 'content'],
    },
    source: 'system',
    isAvailable: true,
  },
];