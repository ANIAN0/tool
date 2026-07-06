// tool/ has no DB. These are the functions the chat shell calls; they
// return empty data so the UI renders correctly. Server actions (createChat,
// deleteChat, etc.) are no-ops.
import type { ActiveChat, ChatListPage, SetupStatus, Viewer } from "@/lib/chat/types";

export async function listChatsPageByUser(
  _userId: string,
): Promise<ChatListPage> {
  return { items: [], nextCursor: null };
}

export async function getChatForUser(
  _userId: string,
  _chatId: string,
): Promise<ActiveChat | null> {
  return null;
}

export async function listBootstrapData(_viewer: Viewer | null, _setup: SetupStatus) {
  return {
    chats: [] as const,
    nextCursor: null,
    setupStatus: _setup,
    viewer: _viewer,
  };
}
