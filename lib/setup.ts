import type { SetupStatus } from "@/lib/chat/types";

const REQUIRED_ENV = [
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "EVE_MODEL",
  "AGENT_API_KEY",
] as const;

export function getInitialSetupStatus(): SetupStatus {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());

  return {
    appReady: missing.length === 0,
    missing,
  };
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return getInitialSetupStatus();
}
