import { NextRequest } from 'next/server';
import { deleteExpiredFiles } from '@/features/file-share/lib/database';

export const runtime = 'nodejs';

/**
 * Cron Job: 定时清理过期文件
 * 由 Vercel Cron Job 触发，每 6 小时执行一次
 */
export async function GET(request: NextRequest) {
  try {
    // 验证来自 Vercel 的请求
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn('未授权的 Cron Job 请求');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${new Date().toISOString()}] Cron Job 开始执行清理任务...`);

    // 执行清理任务
    const deletedCount = await deleteExpiredFiles();

    console.log(`[${new Date().toISOString()}] Cron Job 清理完成，删除了 ${deletedCount} 个过期文件`);

    return Response.json({
      success: true,
      message: '清理任务完成',
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron Job] 执行失败:', error);
    return Response.json(
      {
        success: false,
        error: error.message || '清理任务失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
