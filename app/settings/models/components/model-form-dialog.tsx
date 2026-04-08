/**
 * 模型新增对话框组件
 * 用于创建新模型的表单对话框
 */

"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { CreateModelParams } from "@/lib/hooks/use-user-models";

interface ModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: CreateModelParams) => Promise<boolean>;
  isLoading?: boolean;
}

/**
 * 模型新增对话框组件
 */
export function ModelFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: ModelFormDialogProps) {
  // 表单状态
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [contextLimit, setContextLimit] = useState("32000");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // provider 固定为 openai
  const provider = "openai";

  // 关闭时重置表单
  const handleClose = () => {
    setName("");
    setModel("");
    setApiKey("");
    setBaseUrl("");
    setContextLimit("32000");
    setIsDefault(false);
    setErrors({});
    onOpenChange(false);
  };

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "模型名称是必填项";
    }
    if (!model.trim()) {
      newErrors.model = "模型 ID 是必填项";
    }
    if (!apiKey.trim()) {
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

    const params: CreateModelParams = {
      name: name.trim(),
      provider,
      model: model.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
      contextLimit: parseInt(contextLimit, 10) || undefined,
      isDefault,
    };

    const success = await onSubmit(params);
    if (success) {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加模型</DialogTitle>
          <DialogDescription>
            添加一个新的自定义模型配置
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

          {/* Provider 展示（固定为 OpenAI-Compatible） */}
          <div className="space-y-2">
            <Label htmlFor="provider">
              Provider <span className="text-destructive">*</span>
            </Label>
            <Input id="provider" value="OpenAI-Compatible (openai)" disabled />
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
              API Key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
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

          {/* 上下文上限 */}
          <div className="space-y-2">
            <Label htmlFor="contextLimit">
              上下文上限 (tokens)
              <span className="text-muted-foreground text-xs ml-2">
                (模型支持的最大 token 数，用于会话压缩)
              </span>
            </Label>
            <Input
              id="contextLimit"
              type="number"
              value={contextLimit}
              onChange={(e) => setContextLimit(e.target.value)}
              placeholder="32000"
              disabled={isLoading}
              min={1}
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "添加中..." : "添加模型"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}