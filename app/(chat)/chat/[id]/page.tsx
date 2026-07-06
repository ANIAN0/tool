import { Suspense } from "react";
import { AgentChatRouteSync } from "@/app/_components/agent-chat-route-sync";
import { SessionChatPage } from "@/app/_components/session-chat-page";
import { isProvisionalChatId } from "@/lib/chat/provisional-chat";
import { DEFAULT_CHAT_TITLE } from "@/lib/chat/title";
import type { ActiveChat } from "@/lib/chat/types";

export default async function ChatPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id: chatId } = await params;

  return (
    <SessionChatPage chatId={chatId} key={chatId}>
      <Suspense fallback={null}>
        <ExistingChat chatId={chatId} />
      </Suspense>
    </SessionChatPage>
  );
}

function ExistingChat({
  chatId,
}: {
  readonly chatId: string;
}) {
  if (isProvisionalChatId(chatId)) {
    return <AgentChatRouteSync activeChat={null} chatId={chatId} />;
  }

  const activeChat: ActiveChat = {
    events: [],
    id: chatId,
    pendingUserMessage: null,
    session: undefined,
    title: DEFAULT_CHAT_TITLE,
  };

  return <AgentChatRouteSync activeChat={activeChat} chatId={chatId} />;
}
