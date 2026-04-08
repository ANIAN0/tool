/**
 * Agent 详情抽屉组件
 * 右侧抽屉展示 Agent 完整信息，支持查看和编辑模式
 */

"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Globe,
  Lock,
  Bot,
  Wrench,
  FileText,
  Code,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/utils/authenticated-fetch";

// Agent 详情数据类型
interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  template_id: string;
  template_config: Record<string, unknown>;
  system_prompt: string | null;
  model_id: string | null;
  is_public: boolean;
  enabledSystemTools: string[];
  tools: Array<{
    id: string;
    name: string;
    source: string;
  }>;
  skills: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  created_at: number;
  updated_at: number;
}

// Agent 详情抽屉属性
interface AgentSheetProps {
  agentId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (agentId: string) => void;
}

/**
 * 格式化日期时间
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

/**
 * Agent 详情抽屉组件
 */
export function AgentSheet({ agentId, open, onClose, onEdit }: AgentSheetProps) {
  // 详情数据状态
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 复制状态
  const [copied, setCopied] = useState(false);

  // 加载详情数据
  useEffect(() => {
    if (!agentId || !open) {
      setAgentDetail(null);
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      setAgentDetail(null);

      try {
        const response = await authenticatedFetch(`/api/agents/${agentId}`);
        if (response.ok) {
          const data = await response.json();
          setAgentDetail(data.data);
        } else {
          setError("加载详情失败");
        }
      } catch (err) {
        console.error("加载 Agent 详情失败:", err);
        setError("加载详情失败，请重试");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [agentId, open]);

  // 重试加载
  const retryLoad = () => {
    if (agentId) {
      setLoading(true);
      setError(null);
      // 重新触发 useEffect
      setAgentDetail(null);
    }
  };

  // 复制 API 示例
  const copyApiExample = async () => {
    if (!agentDetail) return;

    const apiExample = `curl -X POST "https://your-domain/api/v1/chat" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"agentName": "${agentDetail.name}", "messages": [...]}'`;

    try {
      await navigator.clipboard.writeText(apiExample);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        {/* 头部区域 */}
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-xl">
            {loading ? "加载中..." : agentDetail?.name ?? "Agent 详情"}
          </SheetTitle>
          <SheetDescription className="text-base">
            {loading ? "正在获取详情信息" : agentDetail?.description ?? "暂无描述"}
          </SheetDescription>
        </SheetHeader>

        {/* 内容区域 */}
        <ScrollArea className="flex-1 px-6">
          {/* 加载状态 */}
          {loading && (
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
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <RefreshCw className="size-5 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={retryLoad}>
                重试
              </Button>
            </div>
          )}

          {/* 详情内容 */}
          {!loading && !error && agentDetail && (
            <div className="flex flex-col gap-6 py-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 创建时间 */}
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="size-3" />
                    <span>创建时间</span>
                  </div>
                  <div className="text-sm font-medium">
                    {formatDateTime(agentDetail.created_at)}
                  </div>
                </div>

                {/* 更新时间 */}
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="size-3" />
                    <span>更新时间</span>
                  </div>
                  <div className="text-sm font-medium">
                    {formatDateTime(agentDetail.updated_at)}
                  </div>
                </div>

                {/* 公开状态 */}
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    {agentDetail.is_public ? (
                      <Globe className="size-3" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    <span>公开状态</span>
                  </div>
                  <div className="text-sm font-medium">
                    {agentDetail.is_public ? "公开" : "私有"}
                  </div>
                </div>

                {/* 模板 */}
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Bot className="size-3" />
                    <span>运行模板</span>
                  </div>
                  <div className="text-sm font-medium">{agentDetail.template_id}</div>
                </div>
              </div>

              {/* 模型配置 */}
              {agentDetail.model_id && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">模型配置</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg border p-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">模型 ID: </span>
                      <span className="font-mono">{agentDetail.model_id}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 工具列表区块 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">工具配置</span>
                </div>
                <div className="flex flex-col gap-2">
                  {/* 系统工具 */}
                  {agentDetail.enabledSystemTools.length > 0 && (
                    <div className="bg-muted/30 rounded-lg border p-4">
                      <div className="text-xs text-muted-foreground mb-2">系统工具</div>
                      <div className="flex flex-wrap gap-2">
                        {agentDetail.enabledSystemTools.map((toolId) => (
                          <Badge key={toolId} variant="secondary" className="text-xs">
                            {toolId.replace("system:sandbox:", "")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MCP 工具 */}
                  {agentDetail.tools.filter((t) => t.source === "mcp").length > 0 && (
                    <div className="bg-muted/30 rounded-lg border p-4">
                      <div className="text-xs text-muted-foreground mb-2">MCP 工具</div>
                      <div className="flex flex-wrap gap-2">
                        {agentDetail.tools
                          .filter((t) => t.source === "mcp")
                          .map((tool) => (
                            <Badge
                              key={tool.id}
                              variant="secondary"
                              className="text-xs bg-blue-100 text-blue-800"
                            >
                              {tool.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 无工具 */}
                  {agentDetail.enabledSystemTools.length === 0 &&
                    agentDetail.tools.length === 0 && (
                      <div className="bg-muted/30 rounded-lg border p-4 text-center text-muted-foreground text-sm">
                        无工具配置
                      </div>
                    )}
                </div>
              </div>

              {/* Skill 列表区块 */}
              {agentDetail.skills.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">关联 Skill</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {agentDetail.skills.length} 个
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {agentDetail.skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="bg-muted/30 rounded-lg border p-4"
                      >
                        <div className="text-sm font-medium">{skill.name}</div>
                        {skill.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {skill.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 系统提示词 */}
              {agentDetail.system_prompt && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">系统提示词</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg border p-4">
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {agentDetail.system_prompt}
                    </pre>
                  </div>
                </div>
              )}

              {/* API 示例区块 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Code className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">API 调用示例</span>
                </div>
                <div className="relative bg-muted/30 rounded-lg border">
                  <pre className="text-xs p-4 overflow-x-auto">
                    <code className="text-muted-foreground whitespace-pre">{`curl -X POST "https://your-domain/api/v1/chat" \\
  -H "Authorization: Bearer sk_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"agentName": "${agentDetail.name}", "messages": [...]}'`}</code>
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
  );
}