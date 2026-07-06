// Single shared secret used by BOTH the eve service and the browser client.
// Next.js inlines `NEXT_PUBLIC_*` at build time, so the browser sees the
// value. The eve service reads the same env var name server-side.
const REQUIRED_ENV = [
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "EVE_MODEL",
  "NEXT_PUBLIC_AGENT_API_KEY",
] as const;

export type SetupStatus = {
  readonly appReady: boolean;
  readonly authReady: boolean;
  readonly databaseConfigured: boolean;
  readonly databaseReady: boolean;
  readonly databaseSchemaReady: boolean;
  readonly missing: readonly string[];
  readonly rateLimitReady: boolean;
};

export function getSetupStatus(): SetupStatus {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  // tool/ has no DB / no better-auth / no rate-limit, so those axes are
  // permanently "not used" and treated as ready to keep the chat shell happy.
  return {
    appReady: missing.length === 0,
    authReady: true,
    databaseConfigured: false,
    databaseReady: false,
    databaseSchemaReady: false,
    missing,
    rateLimitReady: true,
  };
}

export function getInitialSetupStatus(): SetupStatus {
  return getSetupStatus();
}
