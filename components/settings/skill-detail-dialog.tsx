/**
 * Skill 详情弹窗组件
 * 展示 Skill 详情和 API 更新示例代码
 */

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, Code, Calendar, Users, FolderOpen, File } from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

interface SkillDetail {
  id: string;
  name: string;
  description: string;
  metadata: string | null;
  files: Array<{ path: string; content: string }>;
  linkedAgents: string[];
  createdAt: number;
  updatedAt: number;
}

interface SkillDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillId: string | null;
}

export function SkillDetailDialog({ open, onOpenChange, skillId }: SkillDetailDialogProps) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 加载 Skill 详情
  useEffect(() => {
    if (open && skillId) {
      loadDetail();
    }
  }, [open, skillId]);

  const loadDetail = async () => {
    if (!skillId) return;

    try {
      setLoading(true);
      const response = await authenticatedFetch(`/api/skills/${skillId}`);

      if (response.ok) {
        const data = await response.json();
        setDetail(data.data);
      }
    } catch (error) {
      console.error("加载 Skill 详情失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 复制 API 示例代码
  const copyApiExample = async () => {
    if (!detail) return;

    const apiExample = `# 使用 API Key 更新 Skill
curl -X PUT "https://your-domain/api/v1/skills/${encodeURIComponent(detail.name)}" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"files": [...], "fileHash": "..."}'`;

    try {
      await navigator.clipboard.writeText(apiExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* 弹窗头部 - 所有状态都必须有 DialogTitle 以确保无障碍访问 */}
        <DialogHeader>
          {loading ? (
            <DialogTitle>加载中...</DialogTitle>
          ) : detail ? (
            <>
              <DialogTitle>{detail.name}</DialogTitle>
              <DialogDescription>{detail.description}</DialogDescription>
            </>
          ) : (
            <DialogTitle>加载失败</DialogTitle>
          )}
        </DialogHeader>

        {/* 弹窗内容 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="space-y-6 mt-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>创建于 {formatDate(detail.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{detail.linkedAgents.length} 个 Agent 关联</span>
                </div>
              </div>

              {/* 文件列表 */}
              {detail.files && detail.files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <FolderOpen className="h-4 w-4" />
                    <span>文件列表 ({detail.files.length} 个文件)</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detail.files.map((file, index) => (
                      <details key={index} className="bg-muted rounded-lg">
                        <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/80 rounded-lg">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{file.path}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {file.content.length} 字节
                          </span>
                        </summary>
                        <pre className="p-3 pt-0 text-sm overflow-x-auto whitespace-pre-wrap border-t">
                          {file.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* API 更新示例 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Code className="h-4 w-4" />
                    <span>API 更新示例</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyApiExample}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        复制
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`# 使用 API Key 更新 Skill
curl -X PUT "https://your-domain/api/v1/skills/${encodeURIComponent(detail.name)}" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"files": [...], "fileHash": "..."}'`}</code>
                </pre>
              </div>
            </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            无法加载 Skill 详情，请稍后重试
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}