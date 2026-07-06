"use server";

import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { assertChatMessageLength } from "@/lib/chat/limits";
import { createFallbackTitle, DEFAULT_CHAT_TITLE } from "@/lib/chat/title";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function createChatAction(
  input: { readonly pendingUserMessage?: string } = {},
): Promise<{ readonly id: string; readonly title: string; readonly updatedAt: string }> {
  const viewer = await requireViewer();

  if (input.pendingUserMessage) {
    assertChatMessageLength(input.pendingUserMessage);
  }

  const pendingMessage = input.pendingUserMessage?.trim();
  const title = pendingMessage ? createFallbackTitle(pendingMessage) : DEFAULT_CHAT_TITLE;

  return {
    id: crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
  };
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

export async function saveChatSnapshotAction(
  _input: {
    readonly chatId: string;
    readonly events: readonly HandleMessageStreamEvent[];
    readonly session: SessionState;
  },
): Promise<void> {}

export async function saveChatSessionStateAction(
  _input: {
    readonly chatId: string;
    readonly session: SessionState;
  },
): Promise<void> {}

export async function markChatPendingMessageAction(input: {
  readonly chatId: string;
  readonly message: string;
}): Promise<{ readonly allowed: boolean; readonly id: string; readonly title: string; readonly updatedAt: string }> {
  await requireViewer();

  assertChatMessageLength(input.message);

  return {
    allowed: true,
    id: input.chatId,
    title: "",
    updatedAt: new Date().toISOString(),
  };
}

export async function clearChatPendingMessageAction(
  _input: { readonly chatId: string } | string,
): Promise<void> {}

export async function appendChatEventAction(
  _input: {
    readonly chatId: string;
    readonly event: HandleMessageStreamEvent;
    readonly eventIndex: number;
  },
): Promise<void> {}

export async function deleteChatAction(
  _input: { readonly chatId: string } | string,
): Promise<void> {}

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer) {
    throw new Error("Viewer not available.");
  }

  return viewer;
}
