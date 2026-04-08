/**
 * API Key 管理页面
 * 提供创建、查看、删除功能
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Key, Trash2, Loader2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch"; // 导入认证请求工具

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: number | null;
  createdAt: number;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 加载 API Key 列表
  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/api-keys"); // 使用认证请求替代普通 fetch
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      }
    } catch (error) {
      console.error("加载 API Key 列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  // 创建 API Key
  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      return;
    }

    try {
      setCreating(true);
      const response = await authenticatedFetch("/api/api-keys", { // 使用认证请求替代普通 fetch
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedKey(data.data.key);
        setNewKeyName("");
        loadApiKeys();
      }
    } catch (error) {
      console.error("创建 API Key 失败:", error);
    } finally {
      setCreating(false);
    }
  };

  // 删除 API Key
  const handleDelete = async (keyId: string) => {
    if (!confirm("确定要删除这个 API Key 吗？")) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/api-keys/${keyId}`, { // 使用认证请求替代普通 fetch
        method: "DELETE",
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== keyId));
      }
    } catch (error) {
      console.error("删除 API Key 失败:", error);
    }
  };

  // 复制 Key
  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "从未使用";
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和说明 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Key 管理</h1>
        <p className="text-muted-foreground mt-1">
          管理对外接口访问密钥
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建 API Key
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无 API Key，点击上方按钮创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                    <CardDescription className="font-mono">{apiKey.keyPrefix}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(apiKey.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  最后使用: {formatDate(apiKey.lastUsedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建 API Key</DialogTitle>
            <DialogDescription>
              创建新的 API Key，用于调用对外接口
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">请保存您的 API Key：</p>
                <code className="block p-2 bg-background rounded text-sm break-all">{createdKey}</code>
              </div>
              <p className="text-sm text-destructive">
                ⚠️ 此 Key 仅显示一次，请妥善保存
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      复制
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setCreatedKey(null);
                    setCreateDialogOpen(false);
                  }}
                >
                  完成
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  placeholder="例如：生产环境 Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreate} disabled={!newKeyName.trim() || creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "创建"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}