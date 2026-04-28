/**
 * World SDK 数据 Hydration 模块
 */

import type { Event, Step } from '@workflow/world';
import type {
  DebugStepDTO,
  DebugHydratedDataDTO,
  DebugEventDTO,
  DebugStreamChunkDTO,
} from './dto';

const CONTENT_PREVIEW_MAX_LENGTH = 200;

export function hydrateRunData(data: unknown): DebugHydratedDataDTO {
  if (data instanceof Uint8Array) {
    return {
      raw: `[Uint8Array: ${data.byteLength} bytes]`,
      typeHint: 'binary',
      size: data.byteLength,
    };
  }

  if (data == null) {
    return {
      raw: null,
      typeHint: 'null',
      size: 0,
    };
  }

  if (typeof data === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return {
        raw: data,
        typeHint: 'string',
        size: new Blob([data]).size,
      };
    }
    return hydrateRunData(parsed);
  }

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

export function hydrateWorldStep(step: Step): DebugStepDTO {
  let durationMs: number | null = null;
  if (step.startedAt && step.completedAt) {
    durationMs = step.completedAt.getTime() - step.startedAt.getTime();
  }

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

export function hydrateWorldEvent(event: Event): DebugEventDTO {
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

export function hydrateStreamChunk(data: Uint8Array, index: number): DebugStreamChunkDTO {
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return {
      index,
      content,
      isBinary: false,
    };
  } catch {
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

export function truncateContent(parts: string, maxLength: number = CONTENT_PREVIEW_MAX_LENGTH): string {
  if (parts.length <= maxLength) {
    return parts;
  }
  return parts.slice(0, maxLength) + '...';
}