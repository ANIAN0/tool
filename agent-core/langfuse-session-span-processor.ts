import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

const EVE_TURN_SPAN_NAME = "ai.eve.turn";
const LANGFUSE_SESSION_ATTRIBUTE = "langfuse.session.id";
const EVE_SESSION_ATTRIBUTE_KEYS = [
  "eve.session.id",
  "ai.settings.context.eve.session.id",
  // Supports spans emitted during a rolling deployment from the previous
  // runtime-context mapping.
  "ai.settings.context.langfuse.session.id",
] as const;

function readSessionId(span: Span | ReadableSpan): string | undefined {
  for (const key of EVE_SESSION_ATTRIBUTE_KEYS) {
    const value = span.attributes[key];
    if (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= 200 &&
      /^[\x00-\x7F]+$/.test(value)
    ) {
      return value;
    }
  }

  return undefined;
}

function isEveAiSpan(span: Span): boolean {
  return (
    span.name === EVE_TURN_SPAN_NAME ||
    EVE_SESSION_ATTRIBUTE_KEYS.some((key) => span.attributes[key] !== undefined) ||
    Object.keys(span.attributes).some((key) => key.startsWith("gen_ai."))
  );
}

/**
 * Promotes Eve's session context to Langfuse's first-class session attribute.
 * Eve puts the session id on the turn root and selected AI SDK spans, so the
 * trace-local map carries it to generation and tool spans without exporting
 * unrelated HTTP/database spans.
 */
export class EveLangfuseSessionSpanProcessor implements SpanProcessor {
  private readonly sessionByTraceId = new Map<string, string>();

  onStart(span: Span): void {
    const traceId = span.spanContext().traceId;
    const sessionId = readSessionId(span) ?? this.sessionByTraceId.get(traceId);

    if (!sessionId) return;

    this.sessionByTraceId.set(traceId, sessionId);

    // The Eve turn root currently acts only as the OTel container. Keeping it
    // out of Langfuse preserves the existing observation count and hierarchy.
    if (span.name !== EVE_TURN_SPAN_NAME && isEveAiSpan(span)) {
      span.setAttribute(LANGFUSE_SESSION_ATTRIBUTE, sessionId);
    }
  }

  onEnd(span: ReadableSpan): void {
    if (
      span.name === EVE_TURN_SPAN_NAME ||
      typeof span.attributes["eve.session.id"] === "string"
    ) {
      this.sessionByTraceId.delete(span.spanContext().traceId);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    this.sessionByTraceId.clear();
    return Promise.resolve();
  }
}
