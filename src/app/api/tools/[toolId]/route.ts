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
  const pathSegments = url.pathname.split('/');
  const last = pathSegments[pathSegments.length - 1];
  const prev = pathSegments[pathSegments.length - 2];
  let operation = last || 'default';
  if (prev === 'download' || prev === 'delete' || prev === 'deleteFile' || prev === 'list') {
    operation = prev;
  }

  // 处理特殊路由映射
  const operationMap: Record<string, string> = {
    'delete': 'deleteFile',
    'default': 'default'
  };
  
  if (operation in operationMap) {
    operation = operationMap[operation];
  }

  try {
    const apiModule = await import(`@/features/${toolId}/lib/api`);
    const handler = apiModule[operation] || apiModule[url.searchParams.get('op') || 'default'];

    if (typeof handler !== 'function') {
      // 如果仍然找不到处理函数，尝试使用默认处理函数
      if (typeof apiModule.default === 'function') {
        return apiModule.default(request);
      }
      
      return Response.json(
        { error: `操作 ${operation} 不存在` },
        { status: 400 }
      );
    }

    if ((operation === 'download' || operation === 'deleteFile') &&
        (request.method === 'GET' || request.method === 'DELETE')) {
      const fileId = last;
      return handler(request, { params: Promise.resolve({ fileId }) });
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

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as OPTIONS };
