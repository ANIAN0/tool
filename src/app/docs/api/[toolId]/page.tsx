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

export default async function ApiDocPage({ params }: Props) {
  const { toolId } = await params;
  const tool = getToolMetadata(toolId);

  if (!tool || !tool.docs.enabled) {
    notFound();
  }

  return (
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

        {/* API文档内容 - 根据toolId动态渲染 */}
        {toolId === 'image-merger' && <ImageMergerApiDoc tool={tool} />}

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
  );
}

// 图片拼接工具的API文档
function ImageMergerApiDoc({ tool }: { tool: any }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const apiUrl = `${baseUrl}${tool.apiPrefix}`;

  return (
    <div className="space-y-8">
      {/* 接口概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" strokeWidth={2} />
            接口概览
          </CardTitle>
          <CardDescription>基本的 API 端点信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">接口地址</p>
              <code className="block text-sm bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {apiUrl}
              </code>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">请求方式</p>
              <Badge variant="default" className="bg-green-600">
                <Send className="w-3 h-3" />
                POST
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 拼接图片接口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" strokeWidth={2} />
            拼接图片
          </CardTitle>
          <CardDescription>将多张图片按顺序拼接为一张图片</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 请求参数 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求参数</h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">参数名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">必填</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">说明</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">op</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-xs">是</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      操作类型，固定值: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">merge</code>
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">image0, image1...</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">File</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-xs">是</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      图片文件，支持 JPG、PNG、WebP 等格式
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-slate-50"><code>{`# cURL 示例
curl -X POST '${apiUrl}?op=merge' \\
  -F 'image0=@/path/to/image1.jpg' \\
  -F 'image1=@/path/to/image2.png' \\
  -F 'image2=@/path/to/image3.jpg' \\
  --output merged.png

# JavaScript fetch 示例
const formData = new FormData();
formData.append('image0', file1);
formData.append('image1', file2);

const response = await fetch('${apiUrl}?op=merge', {
  method: 'POST',
  body: formData,
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);`}</code></pre>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">响应说明</h3>
            
            {/* 成功响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200)</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Content-Type: <code className="bg-background px-1.5 py-0.5 rounded text-xs">image/png</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>返回拼接后的PNG图片二进制数据</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>所有图片按上传顺序从上到下拼接</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>宽度统一缩放至800px，保持原始宽高比</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* 错误响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">错误响应</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`// 400 Bad Request
{
  "error": "没有上传图片"
}

// 500 Internal Server Error
{
  "error": "图片拼接失败"
}`}</code></pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" strokeWidth={2} />
            使用说明
          </CardTitle>
          <CardDescription>重要提示和注意事项</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>支持同时上传多张图片，文件参数名为 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">image0</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">image1</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">image2</code> ...</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>图片将按参数顺序从上到下拼接</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>所有图片会被缩放至 800px 宽度，高度按比例计算</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>支持常见图片格式：JPG、PNG、WebP、GIF 等</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>输出格式固定为 PNG，支持透明背景</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>请求需使用 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">multipart/form-data</code> 格式</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
