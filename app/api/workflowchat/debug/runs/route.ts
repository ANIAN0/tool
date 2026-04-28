/**
 * 调试 run 列表接口
 * GET /api/workflowchat/debug/runs — 查询 run 列表，支持筛选和游标分页
 */

import { type NextRequest, NextResponse } from 'next/server';
import { listDebugRuns } from '@/lib/workflowchat/debug';
import type { DebugRunListFilters } from '@/lib/workflowchat/debug';
import { WORKFLOWCHAT_RUN_STATUS } from '@/lib/workflowchat/constants';

/** 合法的 run 状态值 */
const VALID_STATUSES = new Set<string>(Object.values(WORKFLOWCHAT_RUN_STATUS));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const status = searchParams.get('status') ?? undefined;
    const conversationId = searchParams.get('conversationId') ?? undefined;
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');

    // 校验 status 参数
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `无效的 status 参数: ${status}` },
        { status: 400 },
      );
    }

    // 解析并校验 limit 参数
    let limit: number | undefined;
    if (limitParam) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: 'limit 参数须为 1~100 之间的整数' },
          { status: 400 },
        );
      }
    }

    const filters: DebugRunListFilters = {
      status: status as DebugRunListFilters['status'],
      conversationId,
      cursor,
      limit,
    };

    const result = await listDebugRuns(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[workflowchat/debug] 获取 run 列表失败:', error);
    return NextResponse.json(
      { error: '获取 run 列表失败' },
      { status: 500 },
    );
  }
}