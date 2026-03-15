"use client";

/**
 * 模型选择器组件
 * 支持系统预设模型和用户自定义模型
 */

import { useState, useEffect } from "react";
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
import { CheckIcon, ChevronDownIcon, User } from "lucide-react";
import { getAnonId } from "@/lib/anon-id";
import type { ApiUserModel } from "@/lib/hooks/use-user-models";

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
  isUserModel?: boolean;
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
  // 用户自定义模型列表
  const [userModels, setUserModels] = useState<Model[]>([]);
  const [isLoadingUserModels, setIsLoadingUserModels] = useState(false);

  // 加载用户自定义模型
  useEffect(() => {
    const fetchUserModels = async () => {
      const anonId = getAnonId();
      if (!anonId) return;

      setIsLoadingUserModels(true);
      try {
        const response = await fetch("/api/user/models", {
          headers: {
            "X-User-Id": anonId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const models: ApiUserModel[] = data.data;
            const formattedModels: Model[] = models.map((m) => ({
              id: `user:${m.id}`, // 使用 user: 前缀标识用户模型
              name: m.name,
              provider: m.provider,
              providerName: m.provider,
              description: `${m.model}${m.is_default ? " (默认)" : ""}`,
              isUserModel: true,
            }));
            setUserModels(formattedModels);
          }
        }
      } catch (error) {
        console.error("加载用户模型失败:", error);
      } finally {
        setIsLoadingUserModels(false);
      }
    };

    fetchUserModels();
  }, []);

  // 合并系统模型和用户模型
  const allModels = [...AVAILABLE_MODELS, ...userModels];

  // 获取当前选中的模型
  const selectedModel = allModels.find((m) => m.id === value);

  // 按供应商分组
  const groupedModels = getGroupedModels(allModels);

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
              {selectedModel.isUserModel ? (
                <User className="size-4" />
              ) : (
                <ModelSelectorLogo className="size-4" provider={selectedModel.provider} />
              )}
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

          {/* 用户自定义模型分组 */}
          {userModels.length > 0 && (
            <ModelSelectorGroup heading="我的模型">
              {userModels.map((model) => (
                <ModelSelectorItem
                  className="gap-2"
                  key={model.id}
                  onSelect={() => onChange?.(model.id)}
                  value={model.id}
                >
                  <User className="size-4 shrink-0" />
                  <ModelSelectorName>
                    <div className="flex items-center gap-1.5">
                      <span>{model.name}</span>
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        自定义
                      </span>
                    </div>
                    {model.description && (
                      <span className="block text-muted-foreground text-xs">
                        {model.description}
                      </span>
                    )}
                  </ModelSelectorName>
                  {value === model.id && (
                    <CheckIcon className="size-4 shrink-0" />
                  )}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          )}

          {/* 按供应商分组显示系统模型 */}
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

/**
 * 获取按供应商分组的模型
 */
function getGroupedModels(models: Model[]): GroupedModels {
  const groups: GroupedModels = {};

  for (const model of models) {
    // 跳过用户自定义模型（已在单独分组中显示）
    if (model.isUserModel) continue;

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
