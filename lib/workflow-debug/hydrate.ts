/**
 * World SDK 数据 Hydration 模块
 * 将 World SDK 返回的原始数据（WorkflowRun、Event、Step、Stream）转换为调试页 DTO
 */

import type { Event, Step } from '@workflow/world';
import type {
  DebugStepDTO,
  DebugHydratedDataDTO,
  DebugEventDTO,
  DebugStreamChunkDTO,
} from './dto';

// ==================== 常量 ====================

/** 内容预览最大长度 */
const CONTENT_PREVIEW_MAX_LENGTH = 200;

// ==================== Hydration 函数 ====================

/**
 * 将 World SDK WorkflowRun 的 input/output 转换为 hydrated 数据摘要
 * 处理 SerializedData（Uint8Array 或原始 JSON）两种格式
 */
export function hydrateRunData(data: unknown): DebugHydratedDataDTO {
  // 二进制序列化数据（Uint8Array）
  if (data instanceof Uint8Array) {
    return {
      raw: `[Uint8Array: ${data.byteLength} bytes]`,
      typeHint: 'binary',
      size: data.byteLength,
    };
  }

  // null / undefined
  if (data == null) {
    return {
      raw: null,
      typeHint: 'null',
      size: 0,
    };
  }

  // 字符串序列化数据
  if (typeof data === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      // 非 JSON 字符串，直接展示
      return {
        raw: data,
        typeHint: 'string',
        size: new Blob([data]).size,
      };
    }
    // JSON 解析成功，递归处理
    return hydrateRunData(parsed);
  }

  // 对象/数组等 JSON 兼容数据
  let size = 0;
  try {
    size = new Blob([JSON.stringify(data)]).size;
  } catch {
    size = 0;
  }

  const typeHint = Array.isArray(data)
    ? `array[${data.length}]`
    : typeof data === 'object' && data !== null
      ? 'object'
      : typeof data;

  return {
    raw: data,
    typeHint,
    size,
  };
}

/**
 * 将 World SDK Step 转换为调试页 Step DTO
 * 结合业务库 step 时间数据和 World SDK 的 hydrated 数据
 */
export function hydrateWorldStep(step: Step): DebugStepDTO {
  // 计算 duration
  let durationMs: number | null = null;
  if (step.startedAt && step.completedAt) {
    durationMs = step.completedAt.getTime() - step.startedAt.getTime();
  }

  // 确定 finishReason
  let finishReason: string | null = null;
  if (step.status === 'completed') {
    finishReason = 'completed';
  } else if (step.status === 'failed') {
    finishReason = 'failed';
  } else if (step.status === 'cancelled') {
    finishReason = 'cancelled';
  }

  return {
    stepId: step.stepId,
    stepName: step.stepName,
    status: step.status,
    attempt: step.attempt,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    durationMs,
    finishReason,
    inputSummary: step.input != null ? hydrateRunData(step.input) : null,
    outputSummary: step.output != null ? hydrateRunData(step.output) : null,
    errorSummary: step.error
      ? { message: step.error.message, code: step.error.code }
      : null,
  };
}

/**
 * 将 World SDK Event 转换为调试页 Event DTO
 * Event 是 discriminated union 类型，需要通过类型断言访问 eventData
 */
export function hydrateWorldEvent(event: Event): DebugEventDTO {
  // Event 是交叉类型：discriminated union (eventType + eventData + correlationId) & { runId, eventId, createdAt }
  // 需要通过类型断言访问 eventData
  const eventAny = event as Record<string, unknown>;
  return {
    eventId: eventAny.eventId as string,
    runId: eventAny.runId as string,
    eventType: event.eventType,
    eventData: eventAny.eventData ?? null,
    correlationId: (eventAny.correlationId as string | undefined) ?? null,
    createdAt: (eventAny.createdAt as Date).toISOString(),
  };
}

/**
 * 将 Stream chunk 转换为调试页 Stream Chunk DTO
 * 尝试 UTF-8 解码，不可解码时标记为二进制
 */
export function hydrateStreamChunk(data: Uint8Array, index: number): DebugStreamChunkDTO {
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return {
      index,
      content,
      isBinary: false,
    };
  } catch {
    // UTF-8 解码失败，标记为二进制并转为 hex 摘要
    const hexPreview = Array.from(data.slice(0, 50))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    return {
      index,
      content: `[binary: ${data.byteLength} bytes] ${hexPreview}${data.byteLength > 50 ? ' ...' : ''}`,
      isBinary: true,
    };
  }
}

/**
 * 生成消息内容预览
 * 截断过长内容为预览文本
 */
export function truncateContent(parts: string, maxLength: number = CONTENT_PREVIEW_MAX_LENGTH): string {
  if (parts.length <= maxLength) {
    return parts;
  }
  return parts.slice(0, maxLength) + '...';
}