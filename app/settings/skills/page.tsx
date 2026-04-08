/**
 * Skill 管理页面
 * 表格布局展示 Skill 列表，详情通过右侧抽屉展示
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Eye,
  Trash2,
  FileText,
  Copy,
  Check,
  Calendar,
  Users,
  FolderOpen,
  Code,
  RefreshCw,
  MoreHorizontal,
} from "lucide-react";
import { SkillUploadDialog } from "@/components/settings/skill-upload-dialog";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// Skill 列表数据类型
interface Skill {
  id: string;
  name: string;
  description: string;
  metadata: string | null;
  agentCount: number;
  fileCount: number;
  totalSize: number;
  createdAt: number;
  updatedAt: number;
}

// Skill 详情数据类型
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

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * 格式化完整日期时间
 */
function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SkillsPage() {
  // Skill 列表状态
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // 详情抽屉状态
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 复制状态
  const [copied, setCopied] = useState(false);

  // 加载 Skill 列表
  const loadSkills = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch("/api/skills");
      if (response.ok) {
        const data = await response.json();
        setSkills(data.skills || []);
      } else {
        console.error("加载 Skill 列表失败");
      }
    } catch (error) {
      console.error("加载 Skill 列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  // 打开详情抽屉
  const handleView = async (skillId: string) => {
    setSelectedSkillId(skillId);
    setSheetOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setSkillDetail(null);

    try {
      const response = await authenticatedFetch(`/api/skills/${skillId}`);
      if (response.ok) {
        const data = await response.json();
        setSkillDetail(data.data);
      } else {
        setDetailError("加载详情失败");
      }
    } catch (error) {
      console.error("加载 Skill 详情失败:", error);
      setDetailError("加载详情失败，请重试");
    } finally {
      setDetailLoading(false);
    }
  };

  // 重试加载详情
  const retryLoadDetail = () => {
    if (selectedSkillId) {
      handleView(selectedSkillId);
    }
  };

  // 删除 Skill
  const handleDelete = async (skill: Skill) => {
    if (skill.agentCount > 0) {
      alert("请先移除关联的 Agent");
      return;
    }

    if (!confirm("确定要删除这个 Skill 吗？")) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/skills/${skill.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSkills(skills.filter((s) => s.id !== skill.id));
      } else {
        const data = await response.json();
        alert(data.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("删除 Skill 失败:", error);
      alert("删除失败");
    }
  };

  // 复制 API 示例代码
  const copyApiExample = async () => {
    if (!skillDetail) return;

    const apiExample = `curl -X PUT "https://your-domain/api/v1/skills/${encodeURIComponent(skillDetail.name)}" \\
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
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skill 管理</h1>
          <p className="text-muted-foreground mt-1">上传和管理 Skill 文件</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="size-4" />
          上传 Skill
        </Button>
      </div>

      {/* 表格区域 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="w-[200px]">描述</TableHead>
              <TableHead className="w-[80px]">文件</TableHead>
              <TableHead className="w-[100px]">大小</TableHead>
              <TableHead className="w-[80px]">Agent</TableHead>
              <TableHead className="w-[120px]">更新时间</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 加载状态：骨架屏 */}
            {loading &&
              [...Array(4)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}

            {/* 空状态 */}
            {!loading && skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <FileText className="size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无 Skill，点击上传添加</p>
                    <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                      <Plus className="size-4" />
                      上传 Skill
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* 数据行 */}
            {!loading &&
              skills.map((skill) => (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{skill.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{skill.fileCount}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(skill.totalSize)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{skill.agentCount}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(skill.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(skill.id)}>
                          <Eye className="size-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(skill)}
                          disabled={skill.agentCount > 0}
                          className={skill.agentCount > 0 ? "" : "text-destructive focus:text-destructive"}
                        >
                          <Trash2 className="size-4 mr-2" />
                          {skill.agentCount > 0 ? "请先移除关联 Agent" : "删除"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* 上传对话框 */}
      <SkillUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          setUploadDialogOpen(false);
          loadSkills();
        }}
      />

      {/* 详情抽屉 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          {/* 头部区域 */}
          <SheetHeader className="p-6 pb-0">
            <SheetTitle className="text-xl">
              {detailLoading ? "加载中..." : skillDetail?.name ?? "Skill 详情"}
            </SheetTitle>
            <SheetDescription className="text-base">
              {detailLoading ? "正在获取详情信息" : skillDetail?.description ?? ""}
            </SheetDescription>
          </SheetHeader>

          {/* 内容区域 */}
          <ScrollArea className="flex-1 px-6">
            {/* 加载状态 */}
            {detailLoading && (
              <div className="flex flex-col gap-6 py-6">
                {/* 统计卡片骨架 */}
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-muted/40 rounded-lg p-4">
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            )}

            {/* 错误状态 */}
            {!detailLoading && detailError && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="size-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{detailError}</p>
                <Button variant="outline" onClick={retryLoadDetail}>
                  重试
                </Button>
              </div>
            )}

            {/* 详情内容 */}
            {!detailLoading && !detailError && skillDetail && (
              <div className="flex flex-col gap-6 py-6">
                {/* 统计卡片 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="size-3" />
                      <span>创建时间</span>
                    </div>
                    <div className="text-sm font-medium">{formatDateTime(skillDetail.createdAt)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="size-3" />
                      <span>更新时间</span>
                    </div>
                    <div className="text-sm font-medium">{formatDateTime(skillDetail.updatedAt)}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="size-3" />
                      <span>Agent 关联</span>
                    </div>
                    <div className="text-sm font-medium">{skillDetail.linkedAgents.length} 个</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <FolderOpen className="size-3" />
                      <span>文件总数</span>
                    </div>
                    <div className="text-sm font-medium">{skillDetail.files.length} 个</div>
                  </div>
                </div>

                {/* 文件列表区块 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">文件列表</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {skillDetail.files.length} 个文件
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {skillDetail.files.map((file, index) => (
                      <details
                        key={file.path}
                        className="group bg-muted/30 rounded-lg border border-transparent hover:border-border/50 transition-colors"
                      >
                        <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
                          <div className="size-7 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{file.path}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(file.content.length)}
                            </div>
                          </div>
                          <div className="text-muted-foreground group-open:rotate-180 transition-transform">
                            <svg
                              className="size-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </summary>
                        <div className="px-4 pb-3">
                          <pre className="text-xs bg-background rounded-md p-3 border max-h-64 overflow-auto">
                            <code className="text-muted-foreground whitespace-pre-wrap break-all">
                              {file.content}
                            </code>
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                {/* API 示例区块 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Code className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">API 更新示例</span>
                  </div>
                  <div className="relative bg-muted/30 rounded-lg border">
                    <pre className="text-xs p-4 overflow-x-auto">
                      <code className="text-muted-foreground whitespace-pre">{`curl -X PUT "https://your-domain/api/v1/skills/${encodeURIComponent(skillDetail.name)}" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"files": [...], "fileHash": "..."}'`}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7"
                      onClick={copyApiExample}
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          <span className="text-xs text-emerald-600">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span className="text-xs">复制</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}