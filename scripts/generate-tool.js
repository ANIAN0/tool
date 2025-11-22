#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const toolId = await prompt('工具ID (kebab-case): ');
  const name = await prompt('工具名称: ');
  const type = await prompt('工具分类 (public-tools/private-tools): ');
  const needsApi = await prompt('需要API吗? (y/n): ') === 'y';

  const toolDir = path.join(__dirname, '../src/features', toolId);
  await fs.mkdir(toolDir, { recursive: true });
  await fs.mkdir(path.join(toolDir, 'components'), { recursive: true });
  await fs.mkdir(path.join(toolDir, 'lib'), { recursive: true });

  await fs.writeFile(
    path.join(toolDir, 'index.ts'),
    `import type { ToolModule } from '@/lib/types';
import MainComponent from './components/Main';

export const metadata: ToolModule = {
  id: '${toolId}',
  name: '${name}',
  description: '请添加功能描述',
  type: '${type}',
  icon: '🔧',
  tags: [],
  isActive: true,
  apiPrefix: ${needsApi ? `'/api/tools/${toolId}'` : 'undefined'},
  docs: { enabled: ${needsApi ? 'true' : 'false'} },
};

export default MainComponent;
`
  );

  await fs.writeFile(
    path.join(toolDir, 'components/Main.tsx'),
    `'use client';

export default function Main() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">${name}</h1>
      <p className="mt-4 text-gray-600">功能开发中...</p>
      <div className="mt-8 p-4 bg-gray-50 rounded">
        <p className="text-sm text-gray-500">
          提示：在 src/features/${toolId}/components/Main.tsx 中实现功能
        </p>
      </div>
    </div>
  );
}
`
  );

  if (needsApi) {
    await fs.writeFile(
      path.join(toolDir, 'lib/api.ts'),
      `export async function default(request: Request) {
  const data = await request.json().catch(() => ({}));
  return Response.json({ 
    message: '${name} API 测试成功',
    received: data 
  });
}
`
    );
  }

  console.log(`✅ 工具 ${toolId} 创建成功！`);
  console.log(`📌 下一步：`);
  console.log(`   1. 将 '${toolId}' 添加到 src/features/registry.ts`);
  console.log(`   2. 执行: npm run build:registry`);
  console.log(`   3. 访问: /${type}/${toolId}`);
}

main().catch(console.error).finally(() => rl.close());
