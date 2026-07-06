import { Suspense } from "react";
import { AgentChatRouteSync } from "@/app/_components/agent-chat-route-sync";
import { SessionChatPage } from "@/app/_components/session-chat-page";
import { getChatForUser } from "@/lib/db/queries";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export default async function ChatPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
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

async function ExistingChat({ chatId }: { readonly chatId: string }) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  const appReady = setupStatus.appReady;
  const activeChat =
    viewer && appReady ? await getChatForUser(chatId, viewer.id) : null;

  return <AgentChatRouteSync activeChat={activeChat} chatId={chatId} />;
}
