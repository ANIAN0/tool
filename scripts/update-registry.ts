import fs from 'fs/promises';
import path from 'path';

async function updateRegistry() {
  const featuresDir = path.join(process.cwd(), 'src/features');
  const entries = await fs.readdir(featuresDir, { withFileTypes: true });
  
  const tools = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'registry.ts')
    .map(dir => dir.name);

  const registryContent = `// 自动生成的注册表，不要手动编辑
import type { ToolModule } from '@/lib/types';

${tools.map(tool => `import { metadata as ${tool.replace(/-/g, '_')}Meta } from './${tool}';`).join('\n')}

export const toolMetadataIndex: Record<string, ToolModule> = {
${tools.map(tool => `  '${tool}': ${tool.replace(/-/g, '_')}Meta,`).join('\n')}
};

export const toolComponentLoader = {
${tools.map(tool => `  '${tool}': () => import('./${tool}'),`).join('\n')}
} as const;

export type ToolId = keyof typeof toolComponentLoader;

export function getToolMetadata(toolId: string): ToolModule | null {
  return toolMetadataIndex[toolId] ?? null;
}

export function getAllTools(): ToolModule[] {
  return Object.values(toolMetadataIndex);
}
`;

  await fs.writeFile(path.join(featuresDir, 'registry.ts'), registryContent);
  console.log('✅ 注册表已更新');
}

updateRegistry().catch(console.error);
