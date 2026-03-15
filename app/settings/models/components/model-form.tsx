/**
 * 模型表单组件
 * 用于创建和编辑模型的表单
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getSupportedProviders, type SupportedProvider } from "@/lib/ai/user-model-provider";
import type { UserModel, CreateModelParams, UpdateModelParams } from "@/lib/hooks/use-user-models";

interface ModelFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateModelParams | UpdateModelParams) => Promise<void>;
  initialData?: UserModel | null;
  isLoading?: boolean;
}

// 支持的 Provider 列表
const SUPPORTED_PROVIDERS = getSupportedProviders();

/**
 * 模型表单组件
 */
export function ModelForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: ModelFormProps) {
  const isEditing = !!initialData;

  // 表单状态
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<SupportedProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 当编辑时，初始化表单数据
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setProvider(initialData.provider as SupportedProvider);
      setModel(initialData.model);
      setApiKey(""); // 编辑时不填充 API Key
      setBaseUrl(
        "base_url" in initialData
          ? initialData.base_url || ""
          : "baseUrl" in initialData
          ? initialData.baseUrl || ""
          : ""
      );
      setIsDefault(
        "is_default" in initialData ? initialData.is_default : initialData.isDefault
      );
    } else {
      // 重置表单
      setName("");
      setProvider("openai");
      setModel("");
      setApiKey("");
      setBaseUrl("");
      setIsDefault(false);
    }
    setErrors({});
  }, [initialData, isOpen]);

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "模型名称是必填项";
    }

    if (!model.trim()) {
      newErrors.model = "模型ID是必填项";
    }

    if (!isEditing && !apiKey.trim()) {
      newErrors.apiKey = "API Key 是必填项";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: CreateModelParams | UpdateModelParams = isEditing
      ? {
          name: name.trim() || undefined,
          provider: provider || undefined,
          model: model.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          isDefault,
        }
      : {
          name: name.trim(),
          provider,
          model: model.trim(),
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || undefined,
          isDefault,
        };

    await onSubmit(data);
  };

  // 处理 Provider 变化
  const handleProviderChange = (value: SupportedProvider) => {
    setProvider(value);
    // 自动填充默认 baseUrl
    const providerInfo = SUPPORTED_PROVIDERS.find((p) => p.id === value);
    if (providerInfo && providerInfo.baseURL) {
      setBaseUrl(providerInfo.baseURL);
    } else {
      setBaseUrl("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑模型" : "添加模型"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "修改您的自定义模型配置"
              : "添加一个新的自定义模型配置"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 模型名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              模型名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 我的 GPT-4"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Provider 选择 */}
          <div className="space-y-2">
            <Label htmlFor="provider">
              Provider <span className="text-destructive">*</span>
            </Label>
            <Select
              value={provider}
              onValueChange={handleProviderChange}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 Provider" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 模型 ID */}
          <div className="space-y-2">
            <Label htmlFor="model">
              模型 ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如: gpt-4"
              disabled={isLoading}
            />
            {errors.model && (
              <p className="text-sm text-destructive">{errors.model}</p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key
              {!isEditing && <span className="text-destructive">*</span>}
              {isEditing && (
                <span className="text-muted-foreground text-xs ml-2">
                  (留空表示不修改)
                </span>
              )}
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEditing ? "••••••••" : "输入 API Key"}
              disabled={isLoading}
            />
            {errors.apiKey && (
              <p className="text-sm text-destructive">{errors.apiKey}</p>
            )}
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              Base URL
              <span className="text-muted-foreground text-xs ml-2">
                (可选，留空使用默认)
              </span>
            </Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              disabled={isLoading}
            />
          </div>

          {/* 设为默认 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              设为默认模型
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "保存中..." : isEditing ? "保存修改" : "添加模型"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
