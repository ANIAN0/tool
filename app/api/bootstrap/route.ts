import { NextResponse } from "next/server";
import { getSetupStatus } from "@/lib/setup";
import { getServerViewer } from "@/lib/session";

export async function GET() {
  const setupStatus = getSetupStatus();
  const viewer = await getServerViewer(setupStatus);
  return NextResponse.json({
    chats: [],
    nextCursor: null,
    setupStatus,
    viewer,
  });
}
