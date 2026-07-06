"use server";

// tool/ has no DB. The chat shell calls these to persist state; we just
// no-op them. eve has its own session storage (server-side, keyed off the
// API key) so we don't need a chat history table.

export async function createChatAction(
  _input: { readonly chatId?: string; readonly pendingUserMessage?: string; readonly title?: string } = {},
): Promise<{ readonly id: string; readonly title: string; readonly updatedAt: string }> {
  return {
    id: _input.chatId ?? crypto.randomUUID(),
    title: _input.title ?? "New chat",
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteChatAction(_input: { readonly chatId: string } | string): Promise<void> {
  return;
}

export async function checkSendLimitAction(
  _input: { readonly chatId?: string; readonly message?: string } = {},
): Promise<{
  readonly allowed: boolean;
  readonly max: number;
  readonly message: string;
  readonly remaining: number;
  readonly retryAfter: number;
}> {
  return {
    allowed: true,
    max: Number.POSITIVE_INFINITY,
    message: "",
    remaining: Number.POSITIVE_INFINITY,
    retryAfter: 0,
  };
}

export async function saveChatSnapshotAction(_input: {
  readonly chatId: string;
  readonly events: unknown;
  readonly session: unknown;
}): Promise<void> {
  return;
}

export async function saveChatSessionStateAction(_input: {
  readonly chatId: string;
  readonly session?: unknown;
  readonly state?: unknown;
}): Promise<void> {
  return;
}

export async function markChatPendingMessageAction(_input: {
  readonly chatId: string;
  readonly message: string;
}): Promise<{ readonly allowed: boolean; readonly id: string; readonly title: string; readonly updatedAt: string }> {
  return {
    allowed: true,
    id: _input.chatId,
    title: "New chat",
    updatedAt: new Date().toISOString(),
  };
}

export async function clearChatPendingMessageAction(_input: { readonly chatId: string } | string): Promise<void> {
  return;
}

export async function appendChatEventAction(_input: {
  readonly chatId: string;
  readonly event: unknown;
  readonly eventIndex?: number;
}): Promise<void> {
  return;
}

export async function skipChatAuthorizationAction(_input: {
  readonly chatId: string;
  readonly message?: string;
  readonly events?: unknown;
  readonly session?: unknown;
}): Promise<{
  readonly allowed: boolean;
  readonly chat: { readonly id: string; readonly title: string; readonly updatedAt: string };
  readonly eventCount: number;
  readonly eventIndex: number;
}> {
  return {
    allowed: true,
    chat: { id: _input.chatId, title: "New chat", updatedAt: new Date().toISOString() },
    eventCount: 0,
    eventIndex: 0,
  };
}
