export const MODEL_SELECTION_HEADER = "x-tool-model-id";
export const MODEL_SELECTION_CONTEXT_PREFIX = "[tool:model-selection]";

export const AGENT_IDS = ["assistant", "research"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export type ModelCatalogEntry = {
  readonly id: string;
  readonly label: string;
  readonly providerModelId: string;
  readonly contextWindowTokens: number;
  readonly agents: readonly AgentId[];
};

export type PublicModelCatalogEntry = Pick<ModelCatalogEntry, "id" | "label">;

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readModelId(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * This is the server-side model allowlist. Add an entry here and configure its
 * matching Vercel environment variables before exposing a new model to users.
 * The browser never receives provider endpoints, credentials, or context limits.
 */
export function getModelCatalog(): readonly ModelCatalogEntry[] {
  const defaultModel = readModelId("EVE_MODEL") ?? "longcat-default";
  const defaultContextWindow = readPositiveInteger(
    "EVE_MODEL_CONTEXT_WINDOW_TOKENS",
    1_000_000,
  );
  const entries: ModelCatalogEntry[] = [
    {
      id: "longcat-default",
      label: "Longcat",
      providerModelId: defaultModel,
      contextWindowTokens: defaultContextWindow,
      agents: AGENT_IDS,
    },
  ];

  const fastModel = readModelId("LONGCAT_FAST_MODEL");
  if (fastModel) {
    entries.push({
      id: "longcat-fast",
      label: "Longcat Fast",
      providerModelId: fastModel,
      contextWindowTokens: readPositiveInteger(
        "LONGCAT_FAST_CONTEXT_WINDOW_TOKENS",
        defaultContextWindow,
      ),
      agents: AGENT_IDS,
    });
  }

  return entries;
}

export function getDefaultModel(): ModelCatalogEntry {
  return getModelCatalog()[0]!;
}

export function getModelForAgent(
  agentId: AgentId,
  modelId: string | null | undefined,
): ModelCatalogEntry | undefined {
  return getModelCatalog().find(
    (model) => model.id === modelId && model.agents.includes(agentId),
  );
}

export function getPublicModelsForAgent(agentId: AgentId): readonly PublicModelCatalogEntry[] {
  return getModelCatalog()
    .filter((model) => model.agents.includes(agentId))
    .map(({ id, label }) => ({ id, label }));
}

export function modelSelectionContext(modelId: string): string {
  return `${MODEL_SELECTION_CONTEXT_PREFIX}${modelId}`;
}

export function modelIdFromMessages(
  messages: readonly { readonly content: unknown }[],
): string | undefined {
  for (const message of [...messages].reverse()) {
    if (typeof message.content !== "string") continue;
    if (message.content.startsWith(MODEL_SELECTION_CONTEXT_PREFIX)) {
      return message.content.slice(MODEL_SELECTION_CONTEXT_PREFIX.length);
    }
  }
  return undefined;
}
