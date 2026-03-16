/**
 * MCP服务器表单组件
 * 用于添加或编辑MCP服务器配置
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
import { AlertCircle, Loader2 } from "lucide-react";
import type { McpServer } from "@/lib/db/schema";

/**
 * 表单数据类型
 */
export interface McpFormData {
  name: string;
  url: string;
}

/**
 * MCP表单组件属性
 */
interface McpFormProps {
  // 是否显示表单
  isOpen: boolean;
  // 关闭表单回调
  onClose: () => void;
  // 提交表单回调
  onSubmit: (data: McpFormData) => Promise<void>;
  // 正在编辑的服务器（null表示新建）
  editingServer?: McpServer | null;
  // 提交中状态
  isSubmitting?: boolean;
  // 错误信息
  error?: string | null;
}

/**
 * 验证URL格式
 * @param url - 待验证的URL
 * @returns 错误信息，无错误返回null
 */
function validateUrl(url: string): string | null {
  if (!url.trim()) {
    return "URL不能为空";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "仅支持HTTP和HTTPS协议";
    }
    return null;
  } catch {
    return "请输入有效的URL地址";
  }
}

/**
 * MCP服务器表单组件
 */
export function McpForm({
  isOpen,
  onClose,
  onSubmit,
  editingServer,
  isSubmitting = false,
  error,
}: McpFormProps) {
  // 表单数据状态
  const [formData, setFormData] = useState<McpFormData>({
    name: "",
    url: "",
  });

  // 字段验证错误
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    url?: string;
  }>({});

  // 当编辑对象变化时重置表单
  useEffect(() => {
    if (editingServer) {
      setFormData({
        name: editingServer.name,
        url: editingServer.url,
      });
    } else {
      setFormData({ name: "", url: "" });
    }
    setFieldErrors({});
  }, [editingServer, isOpen]);

  /**
   * 处理字段变化
   */
  const handleChange = (field: keyof McpFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // 清除该字段的错误
    if (fieldErrors[field]) {
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

    // 验证URL
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

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  /**
   * 处理表单关闭
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const isEditing = !!editingServer;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑MCP服务器" : "添加MCP服务器"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "修改MCP服务器的配置信息"
              : "配置一个新的MCP服务器连接"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* 全局错误提示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
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
              placeholder="例如：我的MCP服务器"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={isSubmitting}
              className={fieldErrors.name ? "border-destructive" : ""}
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          {/* 服务器URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              服务器URL
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
                MCP Streamable HTTP服务器的URL地址
              </p>
            )}
          </div>

          {/* 表单操作按钮 */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "保存" : "添加"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
