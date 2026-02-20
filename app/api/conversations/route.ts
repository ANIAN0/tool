import { getConversations } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * 对话列表 API
 * 获取当前用户的所有对话列表
 * 
 * 请求格式：
 * GET /api/conversations
 * Headers: X-User-Id
 * 
 * 响应格式：
 * { conversations: Conversation[] }
 */
export async function GET(request: Request) {
  try {
    // 从请求头获取用户ID
    const userId = request.headers.get("X-User-Id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "用户ID不能为空" },
        { status: 401 }
      );
    }

    // 获取用户的对话列表（按更新时间倒序）
    const conversations = await getConversations(userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("获取对话列表失败:", error);
    
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
