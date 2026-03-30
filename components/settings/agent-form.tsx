/**
 * Agent表单组件
 * 用于创建和编辑Agent配置
 *
 * 使用 Tabs 组织表单内容，避免内容超出屏幕：
 * - 基本信息：名称、描述、模板选择
 * - 提示词：模型选择、系统提示词
 * - 工具：系统工具、MCP工具
 * - Skill预览：Skill选择、预置提示词预览
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings2, MessageSquare, Wrench, FileText } from "lucide-react";
import { useUserModels } from "@/lib/hooks/use-user-models";
import { useTools } from "@/lib/hooks/use-tools";
import {
  getTemplateList,
  getTemplateDefaultConfig,
  getTemplateById,
} from "@/lib/agents/templates";
import type { AgentWithTools } from "@/lib/db/schema";
import { getDefaultSystemTools, SYSTEM_TOOL_IDS, type SystemToolId, validateSystemToolIds } from "@/lib/constants/system-tools";
import { SkillSelector } from "./skill-selector";
import { SkillPresetPreview } from "./skill-preset-preview";

// ==================== 类型扩展 ====================

/**
 * 扩展 AgentWithTools 类型以包含 skills 属性
 * 用于编辑 Agent 时正确获取关联的 Skill 信息
 */
interface AgentWithSkills extends AgentWithTools {
  skills?: Array<{ id: string; name: string; description: string }>;
}

// ==================== 系统工具联动逻辑 ====================

/**
 * 当选择 Skill 时，自动启用并锁定必要的系统工具
 * bash、readFile、writeFile 是 Skill 运行的必要工具
 */
const REQUIRED_SKILL_TOOLS: SystemToolId[] = [
  'system:sandbox:bash',
  'system:sandbox:readFile',
  'system:sandbox:writeFile',
];

/**
 * 判断某个系统工具是否因 Skill 关联而被强制锁定
 * @param toolId 工具 ID
 * @param skillIds 已选择的 Skill ID 列表
 * @returns 是否被强制锁定
 */
function isToolLockedBySkill(toolId: SystemToolId, skillIds: string[]): boolean {
  // 只有在有 Skill 被选中时，必要工具才会被锁定
  if (skillIds.length === 0) return false;
  return REQUIRED_SKILL_TOOLS.includes(toolId);
}

/**
 * 根据选择的 Skill 自动更新系统工具列表
 * @param currentTools 当前启用的系统工具
 * @param skillIds 已选择的 Skill ID 列表
 * @returns 更新后的系统工具列表
 */
function getUpdatedSystemTools(currentTools: SystemToolId[], skillIds: string[]): SystemToolId[] {
  if (skillIds.length === 0) {
    // 没有 Skill 时，返回原始列表（不解锁任何工具，用户可自由选择）
    return currentTools;
  }
  // 有 Skill 时，确保必要工具被包含
  return [...new Set([...currentTools, ...REQUIRED_SKILL_TOOLS])];
}

/**
 * Agent表单数据接口
 */
export interface AgentFormData {
  // Agent名称
  name: string;
  // Agent描述
  description: string;
  // 模板ID
  templateId: string;
  // 模板配置
  templateConfig: Record<string, unknown>;
  // 系统提示词
  systemPrompt: string;
  // 模型ID
  modelId: string;
  // MCP工具ID列表
  toolIds: string[];
  // 启用的系统工具ID列表
  enabledSystemTools: SystemToolId[];
  // 关联的 Skill ID 列表
  skillIds: string[];
}

/**
 * Agent表单组件属性
 */
interface AgentFormProps {
  // 对话框打开状态
  open: boolean;
  // 要编辑的Agent（null表示创建新Agent）
  agent: AgentWithTools | null;
  // 关闭回调
  onClose: () => void;
  // 提交回调
  onSubmit: (data: AgentFormData) => Promise<void>;
  // 是否加载中
  isLoading?: boolean;
}

/**
 * 默认表单数据
 */
const DEFAULT_FORM_DATA: AgentFormData = {
  name: "",
  description: "",
  templateId: "basic-loop",
  templateConfig: { stepCount: 20 },
  systemPrompt: "",
  modelId: "",
  toolIds: [],
  enabledSystemTools: getDefaultSystemTools(), // 默认启用所有系统工具
  skillIds: [], // 默认不选择任何 Skill
};

/**
 * Agent表单组件
 */
export function AgentForm({
  open,
  agent,
  onClose,
  onSubmit,
  isLoading = false,
}: AgentFormProps) {
  // 表单数据状态
  const [formData, setFormData] = useState<AgentFormData>(DEFAULT_FORM_DATA);
  // 表单验证错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 获取用户模型列表
  const { models, isLoading: isLoadingModels } = useUserModels();
  // 获取工具列表
  const { tools, isLoading: isLoadingTools } = useTools();

  // 获取模板列表
  const templateList = getTemplateList();

  // 可用的 Skill 列表（用于预置提示词预览）
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string; description: string }>>([]);

  /**
   * 监听 Skill 选择变化，自动更新系统工具
   * 当选择 Skill 时，自动启用必要的系统工具
   */
  useEffect(() => {
    if (formData.skillIds.length > 0) {
      // 有 Skill 被选中，确保必要工具被启用
      const updatedTools = getUpdatedSystemTools(
        formData.enabledSystemTools,
        formData.skillIds
      );
      // 使用数组内容比较，检测工具列表是否真正发生变化
      // 排序后比较，确保顺序不影响判断结果
      const currentToolsSorted = [...formData.enabledSystemTools].sort();
      const updatedToolsSorted = [...updatedTools].sort();
      const toolsChanged = updatedToolsSorted.length !== currentToolsSorted.length ||
        updatedToolsSorted.some((tool, i) => tool !== currentToolsSorted[i]);

      // 只有当工具列表内容发生变化时才更新状态，避免无限循环
      if (toolsChanged) {
        setFormData(prev => ({
          ...prev,
          enabledSystemTools: updatedTools,
        }));
      }
    }
  }, [formData.skillIds, formData.enabledSystemTools]);

  /**
   * 当编辑Agent时，初始化表单数据
   */
  useEffect(() => {
    if (open) {
      if (agent) {
        // 编辑模式：从agent初始化表单
        // 辅助函数：安全解析JSON，失败时返回默认配置
        const parseTemplateConfig = (jsonStr: string | null, templateId: string) => {
          if (!jsonStr) return getTemplateDefaultConfig(templateId);
          try {
            return JSON.parse(jsonStr);
          } catch {
            // JSON解析失败时，返回模板默认配置
            console.warn("模板配置JSON解析失败，使用默认配置");
            return getTemplateDefaultConfig(templateId);
          }
        };

        setFormData({
          name: agent.name,
          description: agent.description || "",
          templateId: agent.template_id,
          templateConfig: parseTemplateConfig(agent.template_config, agent.template_id),
          systemPrompt: agent.system_prompt || "",
          modelId: agent.model_id || "",
          toolIds: agent.tools.filter(t => t.source === 'mcp').map((t) => t.id),
          enabledSystemTools: validateSystemToolIds(agent.enabledSystemTools || getDefaultSystemTools()), // 使用 validateSystemToolIds 确保类型安全
          skillIds: (agent as AgentWithSkills).skills?.map((s) => s.id) || [], // 使用扩展类型安全地获取 skills 属性
        });
      } else {
        // 创建模式：重置为默认值
        setFormData(DEFAULT_FORM_DATA);
      }
      // 清除错误
      setErrors({});
    }
  }, [open, agent]);

  /**
   * 处理模板变更
   * 当选择不同模板时，更新默认配置
   */
  const handleTemplateChange = useCallback((templateId: string) => {
    // 获取新模板的默认配置
    const defaultConfig = getTemplateDefaultConfig(templateId);

    setFormData((prev) => ({
      ...prev,
      templateId,
      templateConfig: defaultConfig,
    }));

    // 清除模板相关的错误
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.templateId;
      return newErrors;
    });
  }, []);

  /**
   * 处理模板配置字段变更
   */
  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      setFormData((prev) => ({
        ...prev,
        templateConfig: {
          ...prev.templateConfig,
          [key]: value,
        },
      }));

      // 清除该字段的错误
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`config.${key}`];
        return newErrors;
      });
    },
    []
  );

  /**
   * 处理工具选择切换
   */
  const handleToolToggle = useCallback((toolId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      toolIds: checked
        ? [...prev.toolIds, toolId]
        : prev.toolIds.filter((id) => id !== toolId),
    }));
  }, []);

  /**
   * 处理系统工具选择切换
   */
  const handleSystemToolToggle = useCallback((toolId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      enabledSystemTools: checked
        ? [...prev.enabledSystemTools, toolId as SystemToolId]
        : prev.enabledSystemTools.filter((id) => id !== toolId),
    }));
  }, []);

  /**
   * 验证表单
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // 验证名称
    if (!formData.name.trim()) {
      newErrors.name = "请输入Agent名称";
    }

    // 验证模板
    if (!formData.templateId) {
      newErrors.templateId = "请选择模板";
    }

    // 验证模型
    if (!formData.modelId) {
      newErrors.modelId = "请选择模型";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * 处理表单提交
   */
  const handleSubmit = useCallback(async () => {
    // 验证表单
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("提交表单失败:", error);
    }
  }, [formData, validateForm, onSubmit]);

  /**
   * 渲染模板配置字段
   * 根据选择的模板动态显示配置选项
   */
  const renderTemplateConfigFields = () => {
    // 根据模板ID获取完整的模板定义
    const template = getTemplateById(formData.templateId);
    if (!template) return null;

    // 从模板定义获取配置字段
    const configFields = template.configFields;

    return configFields.map((field) => (
      <div key={field.key} className="flex flex-col gap-2">
        <Label htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.type === "number" && (
          <Input
            id={field.key}
            type="number"
            min={field.min}
            max={field.max}
            value={(formData.templateConfig[field.key] as number) ?? field.defaultValue}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value)) {
                handleConfigChange(field.key, value);
              }
            }}
            className={errors[`config.${field.key}`] ? "border-destructive" : ""}
          />
        )}
        {errors[`config.${field.key}`] && (
          <p className="text-sm text-destructive">{errors[`config.${field.key}`]}</p>
        )}
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      {/* Dialog 设置最大高度，确保内容不超出屏幕 */}
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {agent ? "编辑 Agent" : "创建 Agent"}
          </DialogTitle>
        </DialogHeader>

        {/* 使用 Tabs 组织表单内容，避免内容超出屏幕 */}
        <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
          {/* Tabs 导航栏 */}
          <TabsList className="grid grid-cols-4 w-full shrink-0">
            {/* 基本信息标签页 */}
            <TabsTrigger value="basic" className="gap-1.5">
              <Settings2 data-icon="inline-start" />
              基本信息
            </TabsTrigger>
            {/* 提示词配置标签页 */}
            <TabsTrigger value="prompt" className="gap-1.5">
              <MessageSquare data-icon="inline-start" />
              提示词
            </TabsTrigger>
            {/* 工具配置标签页 */}
            <TabsTrigger value="tools" className="gap-1.5">
              <Wrench data-icon="inline-start" />
              工具
            </TabsTrigger>
            {/* Skill预览标签页 */}
            <TabsTrigger value="skills" className="gap-1.5">
              <FileText data-icon="inline-start" />
              Skill预览
            </TabsTrigger>
          </TabsList>

          {/* ==================== 基本信息页 ==================== */}
          <TabsContent value="basic" className="flex-1 min-h-0 mt-4 overflow-auto">
            <div className="flex flex-col gap-4 pr-4">
              {/* 名称字段 */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">
                  名称
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }));
                    if (errors.name) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.name;
                        return newErrors;
                      });
                    }
                  }}
                  placeholder="输入Agent名称"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              {/* 描述字段 */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="输入Agent描述（可选）"
                />
              </div>

              {/* 模板选择 */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="template">
                  模板
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Select
                  value={formData.templateId}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger
                    id="template"
                    className={errors.templateId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="选择模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex flex-col">
                          <span>{template.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.templateId && (
                  <p className="text-sm text-destructive">{errors.templateId}</p>
                )}
              </div>

              {/* 模板配置（动态渲染） */}
              {renderTemplateConfigFields()}
            </div>
          </TabsContent>

          {/* ==================== 提示词配置页 ==================== */}
          <TabsContent value="prompt" className="flex-1 min-h-0 mt-4 overflow-auto">
            <div className="flex flex-col gap-4 pr-4">
              {/* 模型选择 */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="model">
                  模型
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Select
                  value={formData.modelId}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, modelId: value }));
                    if (errors.modelId) {
                      setErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.modelId;
                        return newErrors;
                      });
                    }
                  }}
                  disabled={isLoadingModels}
                >
                  <SelectTrigger
                    id="model"
                    className={errors.modelId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder={isLoadingModels ? "加载中..." : "选择模型"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                        {"is_default" in model && model.is_default && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (默认)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.modelId && (
                  <p className="text-sm text-destructive">{errors.modelId}</p>
                )}
                {models.length === 0 && !isLoadingModels && (
                  <p className="text-sm text-muted-foreground">
                    暂无可用模型，请先添加模型
                  </p>
                )}
              </div>

              {/* 系统提示词 */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="systemPrompt">系统提示词</Label>
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))
                  }
                  placeholder="输入系统提示词（可选）"
                  rows={8}
                  className="resize-none"
                />
              </div>
            </div>
          </TabsContent>

          {/* ==================== 工具配置页 ==================== */}
          <TabsContent value="tools" className="flex-1 min-h-0 mt-4 overflow-auto">
            <div className="flex flex-col gap-4 pr-4">
              {/* 工具选择 */}
              <div className="flex flex-col gap-2">
                <Label>工具配置</Label>
                {isLoadingTools ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载工具列表中...
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* 系统工具组 */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">系统工具（沙盒环境）</span>
                        {formData.skillIds.length > 0 && (
                          <span className="text-xs text-blue-600">
                            已关联 Skill，部分工具已自动启用
                          </span>
                        )}
                        {formData.enabledSystemTools.length === 0 && formData.skillIds.length === 0 && (
                          <span className="text-xs text-amber-600">
                            禁用所有系统工具可能导致 Agent 无法正常执行任务
                          </span>
                        )}
                      </div>
                      <div className="border rounded-md p-3 bg-muted/30">
                        <div className="flex flex-col gap-3">
                          {SYSTEM_TOOL_IDS.map((toolId) => {
                            const toolInfo = tools.find((t) => t.id === toolId);
                            const toolName = toolId.replace('system:sandbox:', '');
                            const isLocked = isToolLockedBySkill(toolId, formData.skillIds);
                            const isChecked = formData.enabledSystemTools.includes(toolId);

                            return (
                              <div key={toolId} className="flex items-start gap-2">
                                <Checkbox
                                  id={`system-tool-${toolId}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    handleSystemToolToggle(toolId, checked as boolean)
                                  }
                                  disabled={isLocked}
                                />
                                <div className="flex flex-col gap-0.5">
                                  <label
                                    htmlFor={`system-tool-${toolId}`}
                                    className={`text-sm font-medium leading-none ${
                                      isLocked ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'
                                    }`}
                                  >
                                    {toolName}
                                    {isLocked && (
                                      <span className="ml-2 text-xs text-blue-500">(Skill 必需)</span>
                                    )}
                                  </label>
                                  {toolInfo?.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {toolInfo.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* MCP工具组 */}
                    {tools.filter((tool) => tool.source === "mcp").length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">MCP 工具</span>
                        <div className="border rounded-md p-3">
                          <div className="flex flex-col gap-3">
                            {tools
                              .filter((tool) => tool.source === "mcp")
                              .map((tool) => (
                                <div key={tool.id} className="flex items-start gap-2">
                                  <Checkbox
                                    id={`mcp-tool-${tool.id}`}
                                    checked={formData.toolIds.includes(tool.id)}
                                    onCheckedChange={(checked) =>
                                      handleToolToggle(tool.id, checked as boolean)
                                    }
                                    disabled={!tool.isAvailable}
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <label
                                      htmlFor={`mcp-tool-${tool.id}`}
                                      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                        !tool.isAvailable ? "text-muted-foreground" : ""
                                      }`}
                                    >
                                      {tool.name}
                                      {tool.server && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          ({tool.server.name})
                                        </span>
                                      )}
                                    </label>
                                    {tool.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {tool.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 无 MCP 工具提示 */}
                    {tools.filter((tool) => tool.source === "mcp").length === 0 && (
                      <p className="text-sm text-muted-foreground">暂无 MCP 工具</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== Skill预览页 ==================== */}
          <TabsContent value="skills" className="flex-1 min-h-0 mt-4 overflow-auto">
            <div className="flex flex-col gap-4 pr-4">
              {/* Skill 选择 */}
              <div className="flex flex-col gap-2">
                <Label>关联 Skill</Label>
                <p className="text-xs text-muted-foreground">
                  选择 Skill 后，系统将自动启用沙盒工具（bash、readFile、writeFile）
                </p>
                <SkillSelector
                  selectedSkillIds={formData.skillIds}
                  onChange={(skillIds) => setFormData((prev) => ({ ...prev, skillIds }))}
                  onSkillsLoaded={setAvailableSkills}
                />
              </div>

              {/* Skill 预置提示词预览 */}
              {formData.skillIds.length > 0 && (
                <SkillPresetPreview
                  skillIds={formData.skillIds}
                  availableSkills={availableSkills}
                />
              )}

              {/* 无 Skill 提示 */}
              {formData.skillIds.length === 0 && (
                <div className="text-sm text-muted-foreground py-8 text-center border rounded-md bg-muted/30">
                  请先在上方选择关联的 Skill，以查看预置提示词预览
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部操作按钮 */}
        <DialogFooter className="mt-4 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {agent ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}