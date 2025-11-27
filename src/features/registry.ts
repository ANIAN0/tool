// 功能注册表
import type { ToolModule } from '@/lib/types';

export const toolMetadataIndex: Record<string, ToolModule> = {
  'image-merger': {
    id: 'image-merger',
    name: '图片拼接',
    description: '将多张图片按800px宽度从上到下拼接为一张图片',
    type: 'public-tools',
    tags: ['图片', '拼接', '合并'],
    isActive: true,
    apiPrefix: '/api/tools/image-merger',
    docs: { enabled: true },
  },
  'file-share': {
    id: 'file-share',
    name: '文件分享',
    description: '上传图片、视频、语音文件，生成临时URL，文件超过24小时自动删除',
    type: 'private-tools',
    tags: ['文件', '分享', '临时链接'],
    isActive: true,
    apiPrefix: '/api/tools/file-share',
    docs: { enabled: true },
  },
} as const;

export const toolComponentLoader = {
  'image-merger': () => import('./image-merger'),
  'file-share': () => import('./file-share'),
} as const;

export type ToolId = keyof typeof toolComponentLoader;

export function getToolMetadata(toolId: string): ToolModule | null {
  return toolMetadataIndex[toolId] ?? null;
}

export function getAllTools(): ToolModule[] {
  return Object.values(toolMetadataIndex);
}
