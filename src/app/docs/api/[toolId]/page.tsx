import { notFound } from 'next/navigation';
import { getToolMetadata, getAllTools } from '@/features/registry';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  ExternalLink, 
  FileCode, 
  Send,
  CheckCircle2,
  XCircle,
  Info,
  Globe
} from 'lucide-react';
import dynamic from 'next/dynamic';
import AuthCheck from '@/components/AuthCheck';

interface Props {
  params: Promise<{ toolId: string }>;
}

export async function generateStaticParams() {
  const tools = getAllTools();
  return tools
    .filter(tool => tool.docs.enabled)
    .map(tool => ({
      toolId: tool.id,
    }));
}

export async function generateMetadata({ params }: Props) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);
  return tool ? { title: `${tool.name} API文档` } : { title: 'API文档未找到' };
}

// 动态导入各工具的文档组件
const toolDocComponents: Record<string, any> = {
  'image-merger': dynamic(() => import('@/features/image-merger/components/ApiDoc')),
  'file-share': dynamic(() => import('@/features/file-share/components/ApiDoc')),
  // 未来可以添加更多工具的文档组件
  // 'another-tool': dynamic(() => import('@/features/another-tool/components/ApiDoc')),
};

export default async function ApiDocPage({ params }: Props) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);

  if (!tool || !tool.docs.enabled) {
    notFound();
  }

  // 动态获取对应的文档组件
  const ToolDocComponent = toolDocComponents[toolId];

  return (
    <AuthCheck>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Header Navigation */}
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Link href="/welcome">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4" />
                    返回首页
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-6" />
                <span className="text-sm text-muted-foreground">API 文档</span>
              </div>
              <Link href={`/${tool.type}/${tool.id}`}>
                <Button variant="default" size="sm">
                  <ExternalLink className="w-4 h-4" />
                  使用工具
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-5xl">
          {/* Hero Section */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <FileCode className="w-8 h-8 text-primary" strokeWidth={2} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              {tool.name}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              {tool.description}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tool.tags.map(tag => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <Separator className="mb-12" />

          {/* API文档内容 - 动态导入对应工具的文档组件 */}
          {ToolDocComponent ? (
            <ToolDocComponent tool={tool} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>文档建设中</CardTitle>
                <CardDescription>该工具的详细 API 文档正在建设中</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  请稍后再查看，或联系开发者获取更多帮助。
                </p>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <footer className="mt-24 pt-12 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                完整的 API 文档 · 随时可用
              </p>
            </div>
          </footer>
        </main>
      </div>
    </AuthCheck>
  );
}