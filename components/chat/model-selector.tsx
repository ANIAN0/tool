"use client";

/**
 * 模型选择器组件
 * 使用AI Elements的ModelSelector系列组件构建模型选择器
 * 功能点18：模型选择器组件
 */

import {
  ModelSelector as ModelSelectorDialog,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

/**
 * 模型定义
 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  description?: string;
  free?: boolean;
}

/**
 * 可用模型列表（免费模型）
 * 按供应商分组显示
 */
export const AVAILABLE_MODELS: Model[] = [
  // 默认模型
  {
    id: "arcee-ai/trinity-large-preview:free",
    name: "Trinity Large Preview",
    provider: "arcee-ai",
    providerName: "Arcee AI",
    description: "高性能免费模型（默认）",
    free: true,
  },
  // StepFun 模型
  {
    id: "stepfun/step-3.5-flash:free",
    name: "Step 3.5 Flash",
    provider: "stepfun",
    providerName: "StepFun",
    description: "阶跃星辰快速模型",
    free: true,
  },
  // DeepSeek 模型
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1",
    provider: "deepseek",
    providerName: "DeepSeek",
    description: "推理能力强",
    free: true,
  },
  // OpenRouter 免费模型
  {
    id: "openrouter/free",
    name: "Free Model",
    provider: "openrouter",
    providerName: "OpenRouter",
    description: "OpenRouter免费模型",
    free: true,
  },
];

/**
 * 默认模型ID
 */
export const DEFAULT_MODEL_ID = "arcee-ai/trinity-large-preview:free";

/**
 * 按供应商分组的模型
 */
interface GroupedModels {
  [provider: string]: {
    name: string;
    models: Model[];
  };
}

/**
 * 获取按供应商分组的模型
 */
function getGroupedModels(): GroupedModels {
  const groups: GroupedModels = {};

  for (const model of AVAILABLE_MODELS) {
    if (!groups[model.provider]) {
      groups[model.provider] = {
        name: model.providerName,
        models: [],
      };
    }
    groups[model.provider].models.push(model);
  }

  return groups;
}

/**
 * ModelSelectorProps
 */
interface ModelSelectorProps {
  // 当前选中的模型ID
  value?: string;
  // 模型变更回调
  onChange?: (modelId: string) => void;
  // 是否禁用
  disabled?: boolean;
}

/**
 * 模型选择器组件
 * 支持搜索、分组显示、供应商logo
 */
export function ModelSelector({
  value = DEFAULT_MODEL_ID,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  // 获取当前选中的模型
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === value);

  // 按供应商分组
  const groupedModels = getGroupedModels();

  return (
    <ModelSelectorDialog>
      <ModelSelectorTrigger asChild>
        <Button
          className="gap-1.5 text-sm"
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          {/* 显示当前选中模型 */}
          {selectedModel ? (
            <>
              <ModelSelectorLogo className="size-4" provider={selectedModel.provider} />
              <span className="hidden sm:inline">{selectedModel.name}</span>
              <span className="sm:hidden">
                {selectedModel.name.length > 10
                  ? `${selectedModel.name.slice(0, 10)}...`
                  : selectedModel.name}
              </span>
            </>
          ) : (
            <span>选择模型</span>
          )}
          <ChevronDownIcon className="size-3.5 opacity-50" />
        </Button>
      </ModelSelectorTrigger>

      <ModelSelectorContent className="sm:max-w-[320px]" title="选择模型">
        {/* 搜索输入框 */}
        <ModelSelectorInput placeholder="搜索模型..." />

        <ModelSelectorList>
          {/* 无结果提示 */}
          <ModelSelectorEmpty>未找到匹配的模型</ModelSelectorEmpty>

          {/* 按供应商分组显示 */}
          {Object.entries(groupedModels).map(([provider, group]) => (
            <ModelSelectorGroup key={provider} heading={group.name}>
              {group.models.map((model) => (
                <ModelSelectorItem
                  // 选中时显示勾选图标
                  className="gap-2"
                  key={model.id}
                  onSelect={() => onChange?.(model.id)}
                  value={model.id}
                >
                  {/* 供应商logo */}
                  <ModelSelectorLogo provider={model.provider} />
                  {/* 模型名称 */}
                  <ModelSelectorName>
                    <div className="flex items-center gap-1.5">
                      <span>{model.name}</span>
                      {/* 免费标签 */}
                      {model.free && (
                        <span className="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          免费
                        </span>
                      )}
                    </div>
                    {/* 模型描述 */}
                    {model.description && (
                      <span className="block text-muted-foreground text-xs">
                        {model.description}
                      </span>
                    )}
                  </ModelSelectorName>
                  {/* 选中指示器 */}
                  {value === model.id && (
                    <CheckIcon className="size-4 shrink-0" />
                  )}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelectorDialog>
  );
}
