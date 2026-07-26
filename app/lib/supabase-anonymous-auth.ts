"use client";

type StoredSession = {
  readonly access_token: string;
  readonly expires_at: number;
  readonly refresh_token: string;
};

type AuthResponse = StoredSession & {
  readonly expires_in?: number;
};

const STORAGE_KEY = "tool.supabase.session";
let pendingSession: Promise<StoredSession> | undefined;

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Set the public URL and publishable key.");
  }
  return { publishableKey, url };
}

function readStoredSession(): StoredSession | undefined {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const session = JSON.parse(raw) as StoredSession;
    if (
      typeof session.access_token === "string" &&
      typeof session.refresh_token === "string" &&
      typeof session.expires_at === "number"
    ) {
      return session;
    }
  } catch {
    // A corrupt local entry is equivalent to a signed-out anonymous visitor.
  }

  window.localStorage.removeItem(STORAGE_KEY);
  return undefined;
}

function saveSession(session: AuthResponse): StoredSession {
  const expiresAt =
    typeof session.expires_at === "number"
      ? session.expires_at
      : Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
  const stored = {
    access_token: session.access_token,
    expires_at: expiresAt,
    refresh_token: session.refresh_token,
  } satisfies StoredSession;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

async function requestSession(path: string, body: unknown): Promise<StoredSession> {
  const { publishableKey, url } = configuration();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Supabase anonymous sign-in failed (${response.status}).`);
  }
  return saveSession((await response.json()) as AuthResponse);
}

async function createOrRefreshSession(): Promise<StoredSession> {
  const current = readStoredSession();
  const now = Math.floor(Date.now() / 1000);
  if (current && current.expires_at > now + 60) return current;

  if (current?.refresh_token) {
    try {
      return await requestSession("token?grant_type=refresh_token", {
        refresh_token: current.refresh_token,
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Mirrors supabase-js signInAnonymously(): the absence of email/phone
  // creates an anonymous auth.users identity when Anonymous Sign-Ins is enabled.
  return requestSession("signup", {
    data: {},
    gotrue_meta_security: {},
  });
}

export async function getSupabaseAccessToken(): Promise<string> {
  pendingSession ??= createOrRefreshSession().finally(() => {
    pendingSession = undefined;
  });
  return (await pendingSession).access_token;
}
