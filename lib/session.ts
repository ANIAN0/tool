// tool/ has no auth — we just return a single fixed viewer that everyone
// shares. The X-API-Key in the request header is what actually gates the
// eve service; this viewer is just a UI marker so the chat shell thinks
// someone is "signed in".
import type { SetupStatus, Viewer } from "@/lib/chat/types";

const LOCAL_VIEWER: Viewer = {
  email: "local@tool.local",
  id: "local-app",
  image: null,
  name: "local",
};

export async function getServerViewer(
  _setupStatus: SetupStatus,
): Promise<Viewer | null> {
  return LOCAL_VIEWER;
}
