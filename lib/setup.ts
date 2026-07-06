export interface SetupStatus {
  readonly appReady: boolean;
  readonly missing: readonly string[];
}

// Single shared secret used by BOTH the eve service and the browser client.
// Next.js inlines `NEXT_PUBLIC_*` at build time, so the browser sees the
// value. The eve service reads the same env var name server-side.
const REQUIRED_ENV = [
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "EVE_MODEL",
  "NEXT_PUBLIC_AGENT_API_KEY",
] as const;

export function getSetupStatus(): SetupStatus {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  return { appReady: missing.length === 0, missing };
}