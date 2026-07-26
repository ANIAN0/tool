"use client";

import { useEffect, useMemo, useState } from "react";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { getSupabaseAccessToken } from "@/app/lib/supabase-anonymous-auth";
import { AgentMessage } from "./agent-message";

type Model = {
  readonly id: string;
  readonly label: string;
};

type AgentDefinition = {
  readonly id: string;
  readonly label: string;
  readonly models: readonly Model[];
};

type AgentCatalog = {
  readonly agents: readonly AgentDefinition[];
};

const MODEL_SELECTION_HEADER = "x-tool-model-id";

export function AgentChat() {
  const [catalog, setCatalog] = useState<AgentCatalog>();
  const [catalogError, setCatalogError] = useState<string>();
  const [selection, setSelection] = useState<{ agentId: string; modelId: string }>();

  useEffect(() => {
    let active = true;

    void fetch("/api/agent-catalog", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Unable to load agent catalog (${response.status}).`);
        return (await response.json()) as AgentCatalog;
      })
      .then((nextCatalog) => {
        if (!active) return;
        const firstAgent = nextCatalog.agents[0];
        const firstModel = firstAgent?.models[0];
        if (!firstAgent || !firstModel) {
          throw new Error("No server-approved agent model is configured.");
        }
        setCatalog(nextCatalog);
        setSelection({ agentId: firstAgent.id, modelId: firstModel.id });
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : "Unable to load agent catalog.");
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedAgent = useMemo(
    () => catalog?.agents.find((agent) => agent.id === selection?.agentId),
    [catalog, selection?.agentId],
  );
  const selectedModel = selectedAgent?.models.find((model) => model.id === selection?.modelId);

  if (catalogError) return <StartupError message={catalogError} />;
  if (!catalog || !selection || !selectedAgent || !selectedModel) return <StartupState />;

  return (
    <AgentConversation
      agent={selectedAgent}
      agents={catalog.agents}
      key={`${selectedAgent.id}:${selectedModel.id}`}
      model={selectedModel}
      onAgentChange={(agentId) => {
        const agent = catalog.agents.find((candidate) => candidate.id === agentId);
        const model = agent?.models[0];
        if (agent && model) setSelection({ agentId: agent.id, modelId: model.id });
      }}
      onModelChange={(modelId) => setSelection({ agentId: selectedAgent.id, modelId })}
    />
  );
}

function AgentConversation({
  agent,
  agents,
  model,
  onAgentChange,
  onModelChange,
}: {
  readonly agent: AgentDefinition;
  readonly agents: readonly AgentDefinition[];
  readonly model: Model;
  readonly onAgentChange: (agentId: string) => void;
  readonly onModelChange: (modelId: string) => void;
}) {
  const eveAgent = useEveAgent({
    agent: agent.id,
    auth: { bearer: getSupabaseAccessToken },
    headers: () => ({ [MODEL_SELECTION_HEADER]: model.id }),
  });
  const isBusy = eveAgent.status === "submitted" || eveAgent.status === "streaming";
  const isEmpty = eveAgent.data.messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;
    await eveAgent.send({ message: text });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="发送消息…" />
      <PromptInputSubmit onStop={eveAgent.stop} status={eveAgent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="选择 Agent"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            defaultValue={agent.id}
            disabled={isBusy}
            onChange={(event) => onAgentChange(event.target.value)}
          >
            {agents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
          <select
            aria-label="选择模型"
            className="h-8 max-w-40 rounded-md border bg-background px-2 text-sm"
            defaultValue={model.id}
            disabled={isBusy}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {agent.models.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
          <StatusDot status={eveAgent.status} />
        </div>
        <span className="text-muted-foreground text-xs">切换 Agent 或模型会开始新会话</span>
      </header>

      {eveAgent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">请求失败</p>
              <p className="mt-0.5 text-muted-foreground">{eveAgent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {eveAgent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  eveAgent.status === "streaming" && index === eveAgent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) => eveAgent.send({ inputResponses })}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{agent.label}</h1>
            <p className="text-muted-foreground text-sm">以 Supabase 匿名身份开始；注册后可绑定为正式账号。</p>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}

function StartupState() {
  return <main className="grid h-dvh place-items-center text-muted-foreground text-sm">正在加载 Agent 配置…</main>;
}

function StartupError({ message }: { readonly message: string }) {
  return (
    <main className="grid h-dvh place-items-center px-6 text-center">
      <div>
        <p className="font-medium">无法初始化聊天</p>
        <p className="mt-1 text-muted-foreground text-sm">{message}</p>
      </div>
    </main>
  );
}

function StatusDot({ status }: { readonly status: ReturnType<typeof useEveAgent>["status"] }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
