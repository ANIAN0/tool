import { type ReactNode } from "react";
import { AgentChatShell } from "@/app/_components/agent-chat-shell";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export default async function ChatLayout({ children }: { readonly children: ReactNode }) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  return (
    <AgentChatShell
      initialChats={[]}
      initialNextCursor={null}
      setupStatus={setupStatus}
      viewer={viewer}
    >
      {children}
    </AgentChatShell>
  );
}
