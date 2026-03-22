/**
 * Agent模板系统
 * 定义Agent的行为模式和配置参数
 */

/**
 * 模板配置字段定义
 */
export interface TemplateConfigField {
  // 字段键名
  key: string;
  // 显示标签
  label: string;
  // 字段类型
  type: "number" | "string" | "boolean" | "select";
  // 默认值
  defaultValue: unknown;
  // 是否必填
  required?: boolean;
  // 最小值（number类型）
  min?: number;
  // 最大值（number类型）
  max?: number;
  // 选项列表（select类型）
  options?: { value: string; label: string }[];
}

/**
 * Agent模板接口
 */
export interface AgentTemplate {
  // 模板唯一标识
  id: string;
  // 模板名称
  name: string;
  // 模板描述
  description: string;
  // 配置字段定义
  configFields: TemplateConfigField[];
  // 默认配置
  defaultConfig: Record<string, unknown>;
  // 创建停止条件函数
  createStopCondition: (config: Record<string, unknown>) => unknown;
}

/**
 * 基础循环模板
 * 使用步骤计数控制Agent执行循环
 */
const BASIC_LOOP_TEMPLATE: AgentTemplate = {
  id: "basic-loop",
  name: "基础循环模板",
  description: "使用步骤计数控制Agent执行循环，适用于大多数场景",
  configFields: [
    {
      key: "stepCount",
      label: "步骤上限",
      type: "number",
      defaultValue: 20,
      required: true,
      min: 1,
      max: 100,
    },
  ],
  defaultConfig: { stepCount: 20 },
  createStopCondition: (config) => {
    const stepCount = config.stepCount as number;
    // 返回停止条件对象，后续在执行时使用
    return {
      type: "stepCount",
      maxSteps: stepCount,
    };
  },
};

/**
 * 所有可用模板列表
 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  BASIC_LOOP_TEMPLATE,
];

/**
 * 根据模板ID获取模板
 * @param templateId - 模板ID
 * @returns 模板对象，未找到返回null
 */
export function getTemplateById(templateId: string): AgentTemplate | null {
  return AGENT_TEMPLATES.find((t) => t.id === templateId) || null;
}

/**
 * 获取所有模板的简要信息（用于下拉选择）
 */
export function getTemplateList(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return AGENT_TEMPLATES.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

/**
 * 验证模板配置是否有效
 * @param templateId - 模板ID
 * @param config - 配置对象
 * @returns 验证结果
 */
export function validateTemplateConfig(
  templateId: string,
  config: Record<string, unknown>
): { valid: boolean; error?: string } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { valid: false, error: "模板不存在" };
  }

  for (const field of template.configFields) {
    const value = config[field.key];

    // 检查必填字段
    if (field.required && (value === undefined || value === null)) {
      return { valid: false, error: `${field.label}为必填项` };
    }

    // 类型检查
    if (value !== undefined && value !== null) {
      switch (field.type) {
        case "number":
          if (typeof value !== "number" || isNaN(value)) {
            return { valid: false, error: `${field.label}必须是有效数字` };
          }
          if (field.min !== undefined && value < field.min) {
            return { valid: false, error: `${field.label}不能小于${field.min}` };
          }
          if (field.max !== undefined && value > field.max) {
            return { valid: false, error: `${field.label}不能大于${field.max}` };
          }
          break;
        case "string":
          if (typeof value !== "string") {
            return { valid: false, error: `${field.label}必须是文本` };
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") {
            return { valid: false, error: `${field.label}必须是布尔值` };
          }
          break;
        case "select":
          if (field.options && !field.options.some((opt) => opt.value === value)) {
            return { valid: false, error: `${field.label}的值无效` };
          }
          break;
      }
    }
  }

  return { valid: true };
}

/**
 * 获取模板的默认配置
 * @param templateId - 模板ID
 * @returns 默认配置对象
 */
export function getTemplateDefaultConfig(
  templateId: string
): Record<string, unknown> {
  const template = getTemplateById(templateId);
  return template ? { ...template.defaultConfig } : {};
}