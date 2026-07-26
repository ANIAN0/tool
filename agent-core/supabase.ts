type SupabaseServerConfig = {
  readonly url: string;
  readonly publishableKey: string;
  readonly serviceRoleKey: string;
};

type SupabaseUser = {
  readonly id: string;
  readonly is_anonymous?: boolean;
};

type AgentSessionRow = {
  readonly owner_id: string;
  readonly agent_id: string;
};

function readServerConfig(): SupabaseServerConfig | undefined {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) return undefined;
  return { url, publishableKey, serviceRoleKey };
}

export function hasSupabaseServerConfig(): boolean {
  return readServerConfig() !== undefined;
}

export async function getSupabaseUser(accessToken: string): Promise<SupabaseUser | undefined> {
  const config = readServerConfig();
  if (!config) return undefined;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return undefined;

  const user = (await response.json()) as SupabaseUser;
  return typeof user.id === "string" ? user : undefined;
}

export async function recordAgentSession(input: {
  readonly agentId: string;
  readonly ownerId: string;
  readonly sessionId: string;
}): Promise<void> {
  const config = readServerConfig();
  if (!config) throw new Error("Supabase server configuration is missing.");

  const response = await fetch(
    `${config.url}/rest/v1/agent_sessions?on_conflict=session_id`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        agent_id: input.agentId,
        owner_id: input.ownerId,
        session_id: input.sessionId,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to record agent session (${response.status}).`);
  }
}

export async function isAgentSessionOwner(input: {
  readonly agentId: string;
  readonly ownerId: string;
  readonly sessionId: string;
}): Promise<boolean> {
  const config = readServerConfig();
  if (!config) return false;

  const query = new URLSearchParams({
    agent_id: `eq.${input.agentId}`,
    owner_id: `eq.${input.ownerId}`,
    select: "owner_id,agent_id",
    session_id: `eq.${input.sessionId}`,
  });
  const response = await fetch(`${config.url}/rest/v1/agent_sessions?${query}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) return false;

  const rows = (await response.json()) as AgentSessionRow[];
  return rows.length === 1;
}
