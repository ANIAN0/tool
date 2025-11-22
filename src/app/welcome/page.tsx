import { getAllTools } from '@/features/registry';
import { ToolCard } from '@/components/ToolCard';

export const revalidate = 3600;

export default function WelcomePage() {
  const tools = getAllTools();
  const publicTools = tools.filter(t => t.type === 'public-tools');
  const privateTools = tools.filter(t => t.type === 'private-tools');

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <h1 className="text-4xl font-bold mb-2">🛠️ 我的工具箱</h1>
      <p className="text-gray-600 mb-8">收集和部署有用的工具</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 公共工具 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-3">🌐</span> 公共工具
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {publicTools.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* 私有工具 */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-3">🔒</span> 私有工具
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {privateTools.length > 0 ? (
              privateTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))
            ) : (
              <p className="text-gray-400 text-sm">暂无私有工具</p>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>点击工具卡片开始使用 | 共 {tools.length} 个工具</p>
      </footer>
    </div>
  );
}
