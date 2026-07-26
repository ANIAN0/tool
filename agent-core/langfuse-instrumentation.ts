import { LangfuseSpanProcessor } from "@langfuse/otel";
import { registerOTel } from "@vercel/otel";
import { defineInstrumentation } from "eve/instrumentation";
import { EveLangfuseSessionSpanProcessor } from "./langfuse-session-span-processor";

const registrationMarker = Symbol.for("my-tool.langfuse-otel-registered");

type GlobalTelemetryState = typeof globalThis & {
  [registrationMarker]?: boolean;
};

function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

function shouldCaptureContent(): boolean {
  // Langfuse is enabled here to inspect conversations and agent quality. Keep
  // that useful default unless the deployer explicitly opts out of content.
  return process.env.LANGFUSE_CAPTURE_CONTENT !== "false";
}

function registerLangfuse(agentName: string): void {
  if (!isLangfuseConfigured()) return;

  const globalState = globalThis as GlobalTelemetryState;
  if (globalState[registrationMarker]) return;

  globalState[registrationMarker] = true;
  registerOTel({
    serviceName: `my-tool-${agentName}`,
    spanProcessors: [
      new EveLangfuseSessionSpanProcessor(),
      new LangfuseSpanProcessor({
        // Vercel functions can freeze immediately after a streamed response.
        // Immediate export avoids losing the final model and tool spans.
        exportMode: "immediate",
        mediaUploadEnabled: false,
      }),
    ],
  });
}

/**
 * Eve discovers instrumentation from each named agent directory. This factory
 * keeps the exporter singleton while retaining the selected agent as trace
 * metadata on every model step.
 */
export function createLangfuseInstrumentation(agentName: string) {
  const captureContent = shouldCaptureContent();

  return defineInstrumentation({
    setup: () => registerLangfuse(agentName),
    functionId: `my-tool.${agentName}`,
    recordInputs: captureContent,
    recordOutputs: captureContent,
    events: {
      "step.started": (ctx) => {
        const userId = ctx.session.auth.current?.principalId;

        return {
          runtimeContext: {
            "langfuse.trace.name": "agent-chat",
            ...(userId ? { "langfuse.user.id": userId } : {}),
            "langfuse.trace.tags": [`agent:${agentName}`, `channel:${ctx.channel.kind}`],
            "langfuse.trace.metadata.agent_id": agentName,
            "langfuse.trace.metadata.channel": ctx.channel.kind,
          },
        };
      },
    },
  });
}
