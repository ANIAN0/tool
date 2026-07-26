import { eveChannel, defaultEveAuth } from "eve/channels/eve";
import {
  extractBearerToken,
  ForbiddenError,
  localDev,
  UnauthenticatedError,
  type AuthFn,
} from "eve/channels/auth";
import type { SessionAuthContext } from "eve/context";
import {
  getModelForAgent,
  MODEL_SELECTION_HEADER,
  modelSelectionContext,
  type AgentId,
} from "./model-catalog";
import {
  getSupabaseUser,
  hasSupabaseServerConfig,
  isAgentSessionOwner,
  recordAgentSession,
} from "./supabase";

function isProductionDeployment(): boolean {
  return Boolean(process.env.VERCEL) && process.env.VERCEL_ENV !== "development";
}

function sessionIdFromRequest(request: Request): string | undefined {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const sessionIndex = segments.lastIndexOf("session");
  const sessionId = segments[sessionIndex + 1];
  return sessionId || undefined;
}

function waitForSessionRecord(input: {
  readonly agentId: AgentId;
  readonly ownerId: string;
  readonly sessionId: string;
}): Promise<boolean> {
  // The initial stream request may arrive just before the first turn event has
  // persisted the ownership row. Retry briefly rather than opening a window
  // where an unowned session stream can be read.
  return (async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await isAgentSessionOwner(input)) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  })();
}

function supabaseAuth(agentId: AgentId): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null;

    if (!hasSupabaseServerConfig()) {
      if (isProductionDeployment()) {
        throw new UnauthenticatedError({
          code: "supabase_not_configured",
          message: "Supabase server authentication is not configured.",
        });
      }
      return null;
    }

    const user = await getSupabaseUser(token);
    if (!user) return null;

    const sessionId = sessionIdFromRequest(request);
    if (sessionId) {
      const ownsSession = await waitForSessionRecord({
        agentId,
        ownerId: user.id,
        sessionId,
      });
      if (!ownsSession) {
        throw new ForbiddenError({
          code: "session_not_owned",
          message: "This conversation does not belong to the current user.",
        });
      }
    }

    return {
      attributes: { isAnonymous: String(Boolean(user.is_anonymous)) },
      authenticator: "supabase",
      issuer: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
      principalId: user.id,
      principalType: "user",
      subject: user.id,
    } satisfies SessionAuthContext;
  };
}

export function createSupabaseEveChannel(agentId: AgentId) {
  return eveChannel({
    auth: [supabaseAuth(agentId), localDev()],
    uploadPolicy: "disabled",
    onMessage(ctx) {
      const auth = defaultEveAuth(ctx);
      const modelId = ctx.eve.request.headers.get(MODEL_SELECTION_HEADER);
      const selected = getModelForAgent(agentId, modelId);

      // Only the first request chooses a model. Later requests cannot switch a
      // durable session by forging a header; the UI creates a fresh session.
      const context = !ctx.eve.sessionId && selected ? [modelSelectionContext(selected.id)] : [];
      return { auth, context };
    },
    events: {
      async "turn.started"(_event, _channel, ctx) {
        const caller = ctx.session.auth.current;
        if (caller?.authenticator !== "supabase") return;

        await recordAgentSession({
          agentId,
          ownerId: caller.principalId,
          sessionId: ctx.session.id,
        });
      },
    },
  });
}
