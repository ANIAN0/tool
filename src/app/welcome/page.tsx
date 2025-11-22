import { getAllTools } from '@/features/registry';
import { ToolCard } from '@/components/ToolCard';
import { Wrench, Globe, Lock, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const revalidate = 3600;

export default function WelcomePage() {
  const tools = getAllTools();
  const publicTools = tools.filter(t => t.type === 'public-tools');
  const privateTools = tools.filter(t => t.type === 'private-tools');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Wrench className="w-8 h-8 text-primary" strokeWidth={2} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            胡念的工具箱
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            精心收集的实用工具，助力高效工作
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                共 {tools.length} 个工具
              </span>
            </div>
          </div>
        </div>

        <Separator className="mb-12" />

        {/* Tools Grid */}
        <div className="space-y-16">
          {/* 公共工具 */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5">
                <Globe className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">公开工具</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {publicTools.length} 个可用工具
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {publicTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* 私有工具 */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/5">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-500" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">自有工具</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {privateTools.length > 0 ? `${privateTools.length} 个私有工具` : '暂无私有工具'}
                </p>
              </div>
            </div>
            {privateTools.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {privateTools.map(tool => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 py-16 text-center">
                <Lock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-sm font-medium text-muted-foreground mb-1">暂无自有工具</p>
                <p className="text-xs text-muted-foreground/60">未来将添加更多专属工具</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              持续更新中 · 更多工具即将到来
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}