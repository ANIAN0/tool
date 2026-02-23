/**
 * 记忆管理API
 * 提供记忆列表查询和删除功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthContext } from '@/lib/auth/middleware';
import {
  getAllMemories,
  deleteMemory,
  isMemoryConfigured,
  type MemoryType,
} from '@/lib/memory';

// 统一响应类型
type MemoriesResponse = {
  success?: boolean;
  error?: string;
  memories?: unknown[];
  total?: number;
  message?: string;
};

/**
 * 获取记忆列表
 * GET /api/memories?type=user_global&agentId=development
 */
export const GET = withAuth<MemoriesResponse>(async (request: NextRequest, context: AuthContext) => {
  try {
    // 检查Mem0是否配置
    if (!isMemoryConfigured()) {
      return NextResponse.json(
        { error: '记忆功能未配置' },
        { status: 503 }
      );
    }
    
    // 解析查询参数
    const url = new URL(request.url);
    const type = url.searchParams.get('type') as MemoryType | null;
    const agentId = url.searchParams.get('agentId') || undefined;
    
    // 验证类型参数
    if (!type || !['user_global', 'agent_global', 'interaction'].includes(type)) {
      return NextResponse.json(
        { error: '无效的记忆类型，必须是 user_global、agent_global 或 interaction' },
        { status: 400 }
      );
    }
    
    // 获取记忆列表
    const memories = await getAllMemories({
      type,
      userId: context.userId,
      agentId,
    });
    
    return NextResponse.json({
      success: true,
      memories,
      total: memories.length,
    });
  } catch (error) {
    console.error('获取记忆列表失败:', error);
    return NextResponse.json(
      { error: '获取记忆列表失败' },
      { status: 500 }
    );
  }
});

/**
 * 删除记忆
 * DELETE /api/memories?id=xxx
 */
export const DELETE = withAuth<MemoriesResponse>(async (request: NextRequest, context: AuthContext) => {
  try {
    // 检查Mem0是否配置
    if (!isMemoryConfigured()) {
      return NextResponse.json(
        { error: '记忆功能未配置' },
        { status: 503 }
      );
    }
    
    // 解析查询参数
    const url = new URL(request.url);
    const memoryId = url.searchParams.get('id');
    
    if (!memoryId) {
      return NextResponse.json(
        { error: '记忆ID不能为空' },
        { status: 400 }
      );
    }
    
    // 删除记忆
    const success = await deleteMemory(memoryId);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: '记忆已删除',
      });
    } else {
      return NextResponse.json(
        { error: '删除记忆失败' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('删除记忆失败:', error);
    return NextResponse.json(
      { error: '删除记忆失败' },
      { status: 500 }
    );
  }
});
