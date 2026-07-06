"use client";

import { useEveAgent, defaultMessageReducer } from "eve/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EveMessage, EveMessagePart } from "eve/client";
import type { SetupStatus } from "@/lib/setup";

const API_KEY_HEADER = "X-API-Key";

export function Chat({ setupStatus }: { readonly setupStatus: SetupStatus }) {
  const headers = useApiKeyHeaders();
  const { data, send, stop, status, error, reset } = useEveAgent({
    reducer: defaultMessageReducer(),
    headers,
  });
  const messages = data.messages;
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const isBusy = status === "streaming" || status === "submitted";
  const disabled = !setupStatus.appReady || !headers[API_KEY_HEADER];

  const handleSubmit = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isBusy) return;
      setDraft("");
      try {
        await send({ message });
      } catch {
        // The hook surfaces the error via `status`/`error`; the form is reset.
      }
    },
    [isBusy, send],
  );

  if (!setupStatus.appReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Setup required</h1>
          <p className="text-sm text-muted-foreground">
            Set the following environment variables and redeploy:
          </p>
          <ul className="text-left text-sm font-mono">
            {setupStatus.missing.map((name) => (
              <li key={name}>- {name}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-sm font-medium">eve agent</h1>
        <button
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={reset}
          type="button"
        >
          Reset session
        </button>
      </header>

      <main ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Send a message to start.
            </p>
          ) : (
            messages.map((m: EveMessage) => <MessageBubble key={m.id} message={m} />)
          )}
          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
              {error.message}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="border-t px-4 py-3">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(draft);
          }}
        >
          <textarea
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(draft);
              }
            }}
            placeholder={disabled ? "API key missing" : "Ask anything..."}
            rows={1}
            value={draft}
          />
          {isBusy ? (
            <button
              className="rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              onClick={stop}
              type="button"
            >
              Stop
            </button>
          ) : (
            <button
              className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
              disabled={disabled || draft.trim().length === 0}
              type="submit"
            >
              Send
            </button>
          )}
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { readonly message: EveMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p): p is Extract<EveMessagePart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-foreground text-background"
            : "bg-muted text-foreground"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function useApiKeyHeaders(): Record<string, string> {
  const [headers, setHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchApiKey().then((key) => {
      if (key) setHeaders({ [API_KEY_HEADER]: key });
    });
  }, []);

  return headers;
}

async function fetchApiKey(): Promise<string | null> {
  try {
    const stored = window.sessionStorage.getItem("eve-api-key");
    if (stored) return stored;
  } catch {}

  const envKey = (process.env.NEXT_PUBLIC_AGENT_API_KEY ?? "").trim();
  if (envKey) return envKey;

  const input = window.prompt("Enter your AGENT_API_KEY");
  if (!input) return null;
  try {
    window.sessionStorage.setItem("eve-api-key", input.trim());
  } catch {}
  return input.trim();
}