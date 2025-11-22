import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { toolComponentLoader, getToolMetadata, getAllTools } from '@/features/registry';
import { ToolLoading } from '@/components/ToolLoading';
import type { ToolType } from '@/lib/types';

interface Props {
  params: Promise<{ toolType: ToolType; toolId: string }>;
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const tools = getAllTools();
  return tools.map(tool => ({
    toolType: tool.type,
    toolId: tool.id,
  }));
}

export async function generateMetadata({ params }: Props) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);
  return tool ? { title: `${tool.name} - 工具箱` } : { title: '工具未找到' };
}

export default async function ToolPage({ params }: Props) {
  const { toolType, toolId } = await params;
  const tool = getToolMetadata(toolId);

  // 仅验证工具是否存在
  if (!tool || tool.type !== toolType) {
    notFound();
  }

  const loader = toolComponentLoader[toolId as keyof typeof toolComponentLoader];
  if (!loader) {
    notFound();
  }

  const { default: ToolComponent } = await loader();

  return (
    <div className="tool-container">
      <Suspense fallback={<ToolLoading name={tool.name} />}>
        <ToolComponent />
      </Suspense>
    </div>
  );
}
