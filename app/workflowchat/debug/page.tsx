"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ==================== 类型定义（与后端 DTO 对齐） ====================

type RunStatus = "pending" | "running" | "completed" | "failed";

interface DebugRunListItemDTO {
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  status: RunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
}

interface DebugRunListResponse {
  runs: DebugRunListItemDTO[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

interface DebugHydratedMessageDTO {
  id: string;
  role: "user" | "assistant" | "system";
  contentPreview: string;
  contentLength: number;
}

interface DebugHydratedDataDTO {
  raw: unknown;
  typeHint: string;
  size: number;
}

interface DebugStepDTO {
  stepId: string;
  stepName: string;
  status: string;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  finishReason: string | null;
  inputSummary: DebugHydratedDataDTO | null;
  outputSummary: DebugHydratedDataDTO | null;
  errorSummary: { message: string; code?: string } | null;
}

interface DebugRunDetailDTO {
  id: string;
  conversationId: string;
  workflowRunId: string | null;
  workflowName: string;
  modelId: string;
  status: RunStatus;
  errorJson: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  totalDurationMs: number | null;
  createdAt: number;
  updatedAt: number;
  requestMessage: DebugHydratedMessageDTO | null;
  responseMessage: DebugHydratedMessageDTO | null;
  hydratedInput: DebugHydratedDataDTO | null;
  hydratedOutput: DebugHydratedDataDTO | null;
  steps: DebugStepDTO[];
  worldStatus: string | null;
  worldError: { message: string; code?: string } | null;
}

interface DebugEventDTO {
  eventId: string;
  runId: string;
  eventType: string;
  eventData: unknown;
  correlationId: string | null;
  createdAt: string;
}

interface DebugEventListResponse {
  events: DebugEventDTO[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

interface DebugStreamChunkDTO {
  index: number;
  content: string;
  isBinary: boolean;
}

interface DebugStreamDTO {
  streamName: string;
  runId: string;
  done: boolean;
  tailIndex: number;
  chunks: DebugStreamChunkDTO[];
  pagination: { hasMore: boolean; nextCursor: string | null };
}

// ==================== 工具函数 ====================

function formatTime(ts: number | null): string {
  if (ts == null) return "-";
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function truncateId(id: string, len = 8): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function safeJsonStringify(data: unknown): string {
  try {
    if (data === null || data === undefined) return "null";
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

// ==================== Runs 列表组件 ====================

function RunsList({
  onSelectRun,
  selectedRunId,
  statusFilter,
  onStatusFilterChange,
}: {
  onSelectRun: (runId: string) => void;
  selectedRunId: string | null;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}) {
  const [runs, setRuns] = useState<DebugRunListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchRuns = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "20");

        const res = await fetch(`/api/workflowchat/debug/runs?${params}`);
        if (!res.ok) throw new Error(`获取 runs 列表失败: ${res.status}`);
        const data: DebugRunListResponse = await res.json();

        if (cursor) {
          setRuns((prev) => [...prev, ...data.runs]);
        } else {
          setRuns(data.runs);
        }
        setNextCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);
      } catch (err) {
        console.error("[debug] 获取 runs 列表失败:", err);
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleLoadMore = () => {
    if (nextCursor) fetchRuns(nextCursor);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 筛选栏 */}
      <div className="border-b px-3 py-2">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
        >
          <option value="">全部状态</option>
          <option value="pending">等待中</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
        </select>
      </div>

      {/* Runs 列表 */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {loading && runs.length === 0 && (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground animate-pulse">
              加载中…
            </div>
          )}

          {error && (
            <div className="mx-2 my-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {!loading && runs.length === 0 && !error && (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground">
              暂无 runs 数据
            </div>
          )}

          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={`w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent ${
                selectedRunId === run.id
                  ? "bg-accent text-accent-foreground"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={getStatusVariant(run.status)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {getStatusLabel(run.status)}
                </Badge>
                <span className="truncate text-xs font-medium">
                  {run.workflowName}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span title={run.id}>{truncateId(run.id)}</span>
                <span title={run.conversationId}>conv:{truncateId(run.conversationId)}</span>
                {run.totalDurationMs != null && (
                  <span>{formatDuration(run.totalDurationMs)}</span>
                )}
                <span>{formatTime(run.startedAt ?? run.createdAt)}</span>
              </div>
            </button>
          ))}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="mt-2 w-full rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {loading ? "加载中…" : "加载更多"}
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== Run 概览组件 ====================

function RunOverview({ detail }: { detail: DebugRunDetailDTO }) {
  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div>
        <h3 className="mb-2 text-sm font-medium">基本信息</h3>
        <Table>
          <TableBody>
            <TableRow>
              <TableHead className="w-32">Run ID</TableHead>
              <TableCell className="font-mono text-xs">{detail.id}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead>Workflow Run ID</TableHead>
              <TableCell className="font-mono text-xs">
                {detail.workflowRunId ?? "-"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableCell>{detail.workflowName}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableCell>{detail.modelId}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead>Conversation</TableHead>
              <TableCell className="font-mono text-xs">
                {detail.conversationId}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead>状态</TableHead>
              <TableCell>
                <Badge variant={getStatusVariant(detail.status)}>
                  {getStatusLabel(detail.status)}
                </Badge>
                {detail.worldStatus && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (World: {detail.worldStatus})
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableHead>开始时间</TableHead>
              <TableCell>{formatTime(detail.startedAt)}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead>结束时间</TableHead>
              <TableCell>{formatTime(detail.finishedAt)}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead>耗时</TableHead>
              <TableCell>{formatDuration(detail.totalDurationMs)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* 错误信息 */}
      {(detail.errorJson || detail.worldError) && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-destructive">错误信息</h3>
          {detail.worldError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs">
              <p>
                <span className="font-medium">
                  [{detail.worldError.code ?? "ERROR"}]
                </span>{" "}
                {detail.worldError.message}
              </p>
            </div>
          )}
          {detail.errorJson && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
              {detail.errorJson}
            </pre>
          )}
        </div>
      )}

      {/* 请求/响应消息映射 */}
      {(detail.requestMessage || detail.responseMessage) && (
        <div>
          <h3 className="mb-2 text-sm font-medium">消息映射</h3>
          <div className="space-y-2">
            {detail.requestMessage && (
              <div className="rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    请求
                  </Badge>
                  <span className="text-muted-foreground">
                    role: {detail.requestMessage.role}
                  </span>
                  <span className="text-muted-foreground">
                    {detail.requestMessage.contentLength} 字符
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                  {detail.requestMessage.contentPreview}
                </p>
              </div>
            )}
            {detail.responseMessage && (
              <div className="rounded-md border px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    响应
                  </Badge>
                  <span className="text-muted-foreground">
                    role: {detail.responseMessage.role}
                  </span>
                  <span className="text-muted-foreground">
                    {detail.responseMessage.contentLength} 字符
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                  {detail.responseMessage.contentPreview}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hydrated Input/Output */}
      {(detail.hydratedInput || detail.hydratedOutput) && (
        <div>
          <h3 className="mb-2 text-sm font-medium">输入/输出摘要</h3>
          <Accordion type="multiple" className="w-full">
            {detail.hydratedInput && (
              <AccordionItem value="input">
                <AccordionTrigger className="text-xs">
                  输入 — {detail.hydratedInput.typeHint} ({formatBytes(detail.hydratedInput.size)})
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="max-h-60 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
                    {safeJsonStringify(detail.hydratedInput.raw)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            )}
            {detail.hydratedOutput && (
              <AccordionItem value="output">
                <AccordionTrigger className="text-xs">
                  输出 — {detail.hydratedOutput.typeHint} ({formatBytes(detail.hydratedOutput.size)})
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="max-h-60 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
                    {safeJsonStringify(detail.hydratedOutput.raw)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      )}
    </div>
  );
}

// ==================== Steps 时间线组件 ====================

function StepTimeline({ steps }: { steps: DebugStepDTO[] }) {
  if (steps.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无 step 数据
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {steps.map((step, idx) => (
        <div key={step.stepId} className="relative">
          {/* 连接线 */}
          {idx < steps.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
          )}
          <div className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/50">
            {/* 步骤序号指示器 */}
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{step.stepName}</span>
                <Badge
                  variant={getStatusVariant(step.status)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {getStatusLabel(step.status)}
                </Badge>
                {step.durationMs != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(step.durationMs)}
                  </span>
                )}
                {step.finishReason && (
                  <span className="text-[10px] text-muted-foreground">
                    {step.finishReason}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {step.startedAt && (
                  <span>开始: {new Date(step.startedAt).toLocaleString("zh-CN")}</span>
                )}
                {step.startedAt && step.completedAt && " → "}
                {step.completedAt && (
                  <span>完成: {new Date(step.completedAt).toLocaleString("zh-CN")}</span>
                )}
                {step.attempt > 1 && (
                  <span className="ml-2">尝试 #{step.attempt}</span>
                )}
              </div>
              {/* Step 详情（可展开） */}
              {(step.inputSummary || step.outputSummary || step.errorSummary) && (
                <Accordion type="multiple" className="mt-1">
                  {step.inputSummary && (
                    <AccordionItem value={`step-input-${step.stepId}`} className="border-b-0">
                      <AccordionTrigger className="py-1 text-[10px] text-muted-foreground hover:no-underline">
                        输入: {step.inputSummary.typeHint} ({formatBytes(step.inputSummary.size)})
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="max-h-40 overflow-auto rounded-md bg-muted px-2 py-1 text-[10px]">
                          {safeJsonStringify(step.inputSummary.raw)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {step.outputSummary && (
                    <AccordionItem value={`step-output-${step.stepId}`} className="border-b-0">
                      <AccordionTrigger className="py-1 text-[10px] text-muted-foreground hover:no-underline">
                        输出: {step.outputSummary.typeHint} ({formatBytes(step.outputSummary.size)})
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="max-h-40 overflow-auto rounded-md bg-muted px-2 py-1 text-[10px]">
                          {safeJsonStringify(step.outputSummary.raw)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                  {step.errorSummary && (
                    <AccordionItem value={`step-error-${step.stepId}`} className="border-b-0">
                      <AccordionTrigger className="py-1 text-[10px] text-destructive hover:no-underline">
                        错误: {step.errorSummary.message}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-[10px]">
                          {step.errorSummary.code && (
                            <p>
                              <span className="font-medium">
                                [{step.errorSummary.code}]
                              </span>{" "}
                            </p>
                          )}
                          <p>{step.errorSummary.message}</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== Streams/Events 面板组件 ====================

function StreamsEventsPanel({ workflowRunId }: { workflowRunId: string | null }) {
  // pending 状态的 run 没有 workflow_run_id，无法查询 events/streams
  const runId = workflowRunId;

  const [events, setEvents] = useState<DebugEventDTO[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [eventsNextCursor, setEventsNextCursor] = useState<string | null>(null);

  // Stream 状态
  const [streamName, setStreamName] = useState<string>("");
  const [streamData, setStreamData] = useState<DebugStreamDTO | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // 获取 events 列表
  const fetchEvents = useCallback(
    async (cursor?: string) => {
      if (!runId) return;
      setEventsLoading(true);
      setEventsError(null);
      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "50");
        const res = await fetch(
          `/api/workflowchat/debug/runs/${encodeURIComponent(runId)}/events?${params}`
        );
        if (!res.ok) throw new Error(`获取 events 失败: ${res.status}`);
        const data: DebugEventListResponse = await res.json();
        if (cursor) {
          setEvents((prev) => [...prev, ...data.events]);
        } else {
          setEvents(data.events);
        }
        setEventsNextCursor(data.pagination.nextCursor);
        setEventsHasMore(data.pagination.hasMore);
      } catch (err) {
        console.error("[debug] 获取 events 失败:", err);
        setEventsError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setEventsLoading(false);
      }
    },
    [runId]
  );

  useEffect(() => {
    if (runId) fetchEvents();
  }, [fetchEvents, runId]);

  // 获取 stream 内容
  const fetchStream = useCallback(async () => {
    if (!streamName.trim() || !runId) return;
    setStreamLoading(true);
    setStreamError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      const res = await fetch(
        `/api/workflowchat/debug/runs/${encodeURIComponent(runId)}/streams/${encodeURIComponent(streamName)}?${params}`
      );
      if (!res.ok) throw new Error(`获取 stream 失败: ${res.status}`);
      const data: DebugStreamDTO = await res.json();
      setStreamData(data);
    } catch (err) {
      console.error("[debug] 获取 stream 失败:", err);
      setStreamError(err instanceof Error ? err.message : "未知错误");
      setStreamData(null);
    } finally {
      setStreamLoading(false);
    }
  }, [runId, streamName]);

  return (
    <div className="space-y-4">
      {!runId && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          等待中的 run 暂无 workflow run id，无法查看 events/streams
        </div>
      )}
      {runId && (
      <>
      {/* Events 列表 */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Events 列表</h3>
        {eventsLoading && events.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
            加载中…
          </div>
        )}
        {eventsError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {eventsError}
          </div>
        )}
        {!eventsLoading && events.length === 0 && !eventsError && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            暂无 event 数据
          </div>
        )}
        {events.length > 0 && (
          <ScrollArea className="h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">类型</TableHead>
                  <TableHead className="text-[10px]">时间</TableHead>
                  <TableHead className="text-[10px]">关联 ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((evt) => (
                  <TableRow key={evt.eventId}>
                    <TableCell className="text-xs font-mono">
                      {evt.eventType}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {new Date(evt.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">
                      {evt.correlationId ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {eventsHasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={() => fetchEvents(eventsNextCursor ?? undefined)}
                  disabled={eventsLoading}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {eventsLoading ? "加载中…" : "加载更多"}
                </button>
              </div>
            )}
          </ScrollArea>
        )}

        {/* Event 详情展开 */}
        {events.length > 0 && (
          <Accordion type="multiple" className="mt-2">
            {events.slice(0, 10).map((evt) => (
              <AccordionItem key={evt.eventId} value={`evt-${evt.eventId}`}>
                <AccordionTrigger className="text-[10px]">
                  {evt.eventType} — {truncateId(evt.eventId, 12)}
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted px-2 py-1 text-[10px]">
                    {safeJsonStringify(evt.eventData)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Stream 查看器 */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Stream 查看器</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={streamName}
            onChange={(e) => setStreamName(e.target.value)}
            placeholder="输入 stream 名称（如 logs）"
            className="h-8 flex-1 rounded-md border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchStream();
            }}
          />
          <button
            onClick={fetchStream}
            disabled={streamLoading || !streamName.trim()}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {streamLoading ? "加载中…" : "查看"}
          </button>
        </div>
        {/* 快捷 stream 按钮 */}
        <div className="mt-2 flex gap-1.5">
          {["logs", "default"].map((name) => (
            <button
              key={name}
              onClick={() => {
                setStreamName(name);
              }}
              className="rounded-md border border-input px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {name}
            </button>
          ))}
        </div>
        {streamError && (
          <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {streamError}
          </div>
        )}
        {streamData && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{streamData.streamName}</span>
              <span>
                {streamData.chunks.length} chunks
              </span>
              <span>
                {streamData.done ? "已完成" : "进行中"}
              </span>
              <span>
                tailIndex: {streamData.tailIndex}
              </span>
            </div>
            <ScrollArea className="mt-2 h-72 rounded-md border">
              <pre className="p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
                {streamData.chunks.map((chunk) => chunk.content).join("")}
              </pre>
            </ScrollArea>
            {streamData.pagination.hasMore && (
              <div className="mt-1 text-center">
                <span className="text-[10px] text-muted-foreground">
                  还有更多内容…
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// ==================== 主调试页 ====================

export default function DebugPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<DebugRunDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 选中 run 时加载详情
  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(
          `/api/workflowchat/debug/runs/${encodeURIComponent(selectedRunId!)}`
        );
        if (!res.ok) throw new Error(`获取 run 详情失败: ${res.status}`);
        const data: DebugRunDetailDTO = await res.json();
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        console.error("[debug] 获取 run 详情失败:", err);
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : "未知错误");
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <h1 className="text-lg font-semibold text-foreground">
          WorkflowChat 调试页
        </h1>
        <span className="text-xs text-muted-foreground">
          Runs 列表 · 详情 · Streams
        </span>
      </header>

      {/* 主内容区：左侧面板 + 右侧详情 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：Runs 列表 */}
        <aside className="w-72 shrink-0 border-r">
          <RunsList
            onSelectRun={setSelectedRunId}
            selectedRunId={selectedRunId}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </aside>

        {/* 右侧：Run 详情 */}
        <main className="flex-1 overflow-y-auto">
          {!selectedRunId && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              选择一个 run 查看详情
            </div>
          )}

          {selectedRunId && detailLoading && !detail && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
              加载中…
            </div>
          )}

          {selectedRunId && detailError && !detail && (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {detailError}
              </div>
            </div>
          )}

          {detail && (
            <div className="p-6">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="steps">Steps 时间线</TabsTrigger>
                  <TabsTrigger value="streams">Streams/Events</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <RunOverview detail={detail} />
                </TabsContent>

                <TabsContent value="steps">
                  <StepTimeline steps={detail.steps} />
                </TabsContent>

                <TabsContent value="streams">
                  <StreamsEventsPanel workflowRunId={detail.workflowRunId} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}