import { notFound } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { getToolMetadata } from '@/features/registry';

export const runtime = 'nodejs';

export async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);

  if (!tool || !tool.isActive) {
    notFound();
  }

  const url = new URL(request.url);
  const operation = url.searchParams.get('op') || 'default';

  try {
    const apiModule = await import(`@/features/${toolId}/lib/api`);
    const handler = apiModule[operation];

    if (typeof handler !== 'function') {
      return Response.json(
        { error: `操作 ${operation} 不存在` },
        { status: 400 }
      );
    }

    return handler(request);
  } catch (error) {
    console.error(`API加载失败: ${toolId}`, error);
    return Response.json(
      { error: '工具服务不可用' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
