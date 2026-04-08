/**
 * MCP 服务器表单对话框组件
 * 用于创建和编辑 MCP 服务器配置
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Plus, X } from "lucide-react";
import type { McpServer } from "@/lib/db/schema";

/**
 * 表单数据类型
 */
export interface McpFormData {
  name: string;
  url: string;
  headers?: string; // JSON 格式的 headers
}

/**
 * MCP 表单对话框组件属性
 */
interface McpFormDialogProps {
  // 是否显示表单
  open: boolean;
  // 关闭表单回调
  onOpenChange: (open: boolean) => void;
  // 提交表单回调
  onSubmit: (data: McpFormData) => Promise<void>;
  // 正在编辑的服务器（null 表示新建）
  editingServer?: McpServer | null;
  // 提交中状态
  isSubmitting?: boolean;
}

/**
 * 验证 URL 格式
 * @param url - 待验证的 URL
 * @returns 错误信息，无错误返回 null
 */
function validateUrl(url: string): string | null {
  if (!url.trim()) {
    return "URL 不能为空";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "仅支持 HTTP 和 HTTPS 协议";
    }
    return null;
  } catch {
    return "请输入有效的 URL 地址";
  }
}

/**
 * MCP 服务器表单对话框组件
 */
export function McpFormDialog({
  open,
  onOpenChange,
  onSubmit,
  editingServer,
  isSubmitting = false,
}: McpFormDialogProps) {
  // 表单数据状态
  const [formData, setFormData] = useState<McpFormData>({
    name: "",
    url: "",
    headers: "",
  });

  // Headers 键值对状态
  const [headerPairs, setHeaderPairs] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);

  // 字段验证错误
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    url?: string;
  }>({});

  // 全局错误
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 当编辑对象变化时重置表单
  useEffect(() => {
    if (open) {
      if (editingServer) {
        // 编辑模式：填充现有数据
        setFormData({
          name: editingServer.name,
          url: editingServer.url,
          headers: editingServer.headers || "",
        });
        // 解析现有的 headers
        if (editingServer.headers) {
          try {
            const parsed = JSON.parse(editingServer.headers);
            const pairs = Object.entries(parsed).map(([key, value]) => ({
              key,
              value: String(value),
            }));
            setHeaderPairs(pairs.length > 0 ? pairs : [{ key: "", value: "" }]);
          } catch {
            setHeaderPairs([{ key: "", value: "" }]);
          }
        } else {
          setHeaderPairs([{ key: "", value: "" }]);
        }
      } else {
        // 新建模式：清空表单
        setFormData({ name: "", url: "", headers: "" });
        setHeaderPairs([{ key: "", value: "" }]);
      }
      // 清空错误
      setFieldErrors({});
      setGlobalError(null);
    }
  }, [editingServer, open]);

  /**
   * 处理字段变化
   */
  const handleChange = (field: keyof McpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // 清除该字段的错误
    if ((field === "name" || field === "url") && fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    const errors: { name?: string; url?: string } = {};

    // 验证名称
    if (!formData.name.trim()) {
      errors.name = "服务器名称不能为空";
    }

    // 验证 URL
    const urlError = validateUrl(formData.url);
    if (urlError) {
      errors.url = urlError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateForm()) {
      return;
    }

    // 转换 headers 为 JSON
    const headersObj: Record<string, string> = {};
    for (const pair of headerPairs) {
      if (pair.key.trim()) {
        headersObj[pair.key.trim()] = pair.value;
      }
    }
    const headersJson =
      Object.keys(headersObj).length > 0 ? JSON.stringify(headersObj) : undefined;

    try {
      await onSubmit({
        name: formData.name,
        url: formData.url,
        headers: headersJson,
      });
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "操作失败");
    }
  };

  /**
   * 添加 Header 键值对
   */
  const addHeaderPair = () => {
    setHeaderPairs([...headerPairs, { key: "", value: "" }]);
  };

  /**
   * 删除 Header 键值对
   */
  const removeHeaderPair = (index: number) => {
    const newPairs = headerPairs.filter((_, i) => i !== index);
    setHeaderPairs(newPairs.length > 0 ? newPairs : [{ key: "", value: "" }]);
  };

  /**
   * 更新 Header 键值对
   */
  const updateHeaderPair = (index: number, field: "key" | "value", value: string) => {
    const newPairs = [...headerPairs];
    newPairs[index][field] = value;
    setHeaderPairs(newPairs);
  };

  const isEditing = !!editingServer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑 MCP 服务器" : "添加 MCP 服务器"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "修改 MCP 服务器的配置信息" : "配置一个新的 MCP 服务器连接"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* 全局错误提示 */}
          {globalError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          {/* 服务器名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              服务器名称
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="name"
              placeholder="例如：我的 MCP 服务器"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={isSubmitting}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          {/* 服务器 URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              服务器 URL
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/mcp"
              value={formData.url}
              onChange={(e) => handleChange("url", e.target.value)}
              disabled={isSubmitting}
              className={fieldErrors.url ? "border-destructive" : ""}
            />
            {fieldErrors.url ? (
              <p className="text-sm text-destructive">{fieldErrors.url}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                MCP Streamable HTTP 服务器的 URL 地址
              </p>
            )}
          </div>

          {/* Headers 配置 */}
          <div className="space-y-2">
            <Label>请求 Headers（可选）</Label>
            <div className="space-y-2">
              {headerPairs.map((pair, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Header 名称"
                    value={pair.key}
                    onChange={(e) => updateHeaderPair(index, "key", e.target.value)}
                    disabled={isSubmitting}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header 值"
                    value={pair.value}
                    onChange={(e) => updateHeaderPair(index, "value", e.target.value)}
                    disabled={isSubmitting}
                    className="flex-1"
                  />
                  {headerPairs.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeHeaderPair(index)}
                      disabled={isSubmitting}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addHeaderPair}
              disabled={isSubmitting}
              className="mt-2"
            >
              <Plus className="size-4" />
              添加 Header
            </Button>
            <p className="text-sm text-muted-foreground">
              用于 MCP 服务器的认证，例如 Authorization、X-API-Key 等
            </p>
          </div>

          {/* 表单操作按钮 */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {isEditing ? "保存" : "添加"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}