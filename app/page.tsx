import { Chat } from "@/app/_components/chat";
import { getSetupStatus } from "@/lib/setup";

export default function Page() {
  const setupStatus = getSetupStatus();

  return <Chat setupStatus={setupStatus} />;
}