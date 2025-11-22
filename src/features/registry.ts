// 功能注册表
import type { ToolModule } from '@/lib/types';

export const toolMetadataIndex: Record<string, ToolModule> = {
  'image-merger': {
    id: 'image-merger',
    name: '图片拼接',
    description: '将多张图片按800px宽度从上到下拼接为一张图片',
    type: 'public-tools',
    icon: '🖼️',
    tags: ['图片', '拼接', '合并'],
    isActive: true,
    apiPrefix: '/api/tools/image-merger',
    docs: { enabled: true },
  },
} as const;

export const toolComponentLoader = {
  'image-merger': () => import('./image-merger'),
} as const;

export type ToolId = keyof typeof toolComponentLoader;

export function getToolMetadata(toolId: string): ToolModule | null {
  return toolMetadataIndex[toolId] ?? null;
}

export function getAllTools(): ToolModule[] {
  return Object.values(toolMetadataIndex);
}
