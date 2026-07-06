import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ chats: [], nextCursor: null });
}

export async function POST() {
  return NextResponse.json({ id: crypto.randomUUID() });
}
