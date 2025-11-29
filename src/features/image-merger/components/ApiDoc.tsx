'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Send,
  CheckCircle2,
  XCircle,
  Info,
  FileCode
} from 'lucide-react';

export default function ImageMergerApiDoc({ tool }: { tool: any }) {
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
          <CardDescription>支持四种上传方式：FormData、二进制数据、Base64 JSON、图片URL。自动调用文件上传接口保存拼接结果。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 请求参数 - FormData 方式 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">方式 1: FormData 上传（推荐）</h3>
            <p className="text-sm text-muted-foreground">支持本地文件和网络图片URL混合上传</p>
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
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      本地图片文件，支持 JPG、PNG、WebP 等格式
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">imageUrl0, imageUrl1...</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      网络图片URL，支持 JPG、PNG、WebP 等格式，最多 20 张
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">returnType</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      返回类型: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">file</code> (默认) 或 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">url</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 方式 2: 二进制数据 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">方式 2: 二进制数据上传</h3>
            <p className="text-sm text-muted-foreground">直接上传单张图片的二进制数据</p>
            <div className="rounded-lg border bg-muted/30 p-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Content-Type: <code className="bg-background px-1.5 py-0.5 rounded text-xs">image/jpeg</code> 或 <code className="bg-background px-1.5 py-0.5 rounded text-xs">image/png</code> 等</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>请求体为图片的二进制数据</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>仅支持单张图片（会直接返回缩放后的图片）</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 方式 3: JSON Base64 或 URL */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">方式 3: JSON + Base64/URL 上传</h3>
            <p className="text-sm text-muted-foreground">通过 JSON 传递 base64 编码的图片或图片URL，支持多图片</p>
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
                    <td className="px-4 py-3 text-sm font-mono text-foreground">images</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string[]</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      base64 编码的图片数组，支持带或不带 data URI 前缀
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">imageUrls</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string[]</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      图片URL数组，支持 JPG、PNG、WebP 等格式
                    </td>
                  </tr>
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">returnType</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">string</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">可选</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      返回类型: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">file</code> (默认) 或 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">url</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 图片处理说明 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">图片处理说明</h3>
            <div className="rounded-lg border bg-muted/30 p-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>所有图片宽度统一缩放至 600px，高度按比例计算</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>图片按参数顺序从上到下拼接</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>输出格式为 JPEG，质量设为 70</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>最多支持上传 20 张图片</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持跨域调用 (CORS enabled)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            
            {/* FormData 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">FormData 方式（混合上传）</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`# cURL 示例 - 本地文件 + 网络图片
curl -X POST '${apiUrl}?op=merge' \\
  -F 'image0=@/path/to/local-image.jpg' \\
  -F 'imageUrl0=https://example.com/remote-image1.png' \\
  -F 'imageUrl1=https://example.com/remote-image2.webp' \\
  --output merged.png

# JavaScript fetch 示例
const formData = new FormData();
formData.append('image0', localFile);
formData.append('imageUrl0', 'https://example.com/image1.jpg');
formData.append('imageUrl1', 'https://example.com/image2.png');

const response = await fetch('${apiUrl}?op=merge', {
  method: 'POST',
  body: formData,
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);`}</code></pre>
              </div>
            </div>

            {/* JSON URL 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">JSON + URL 方式 (returnType=url)</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`# cURL 示例
curl -X POST '${apiUrl}?op=merge' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "imageUrls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.png"
    ],
    "returnType": "url"
  }' \\
  --output response.json

# 响应示例
{
  "message": "图片拼接成功",
  "url": "https://your-domain.com/api/tools/file-share?op=download&fileId=550e8400-e29b-41d4-a716-446655440000",
  "fileId": "550e8400-e29b-41d4-a716-446655440000"
}`}</code></pre>
              </div>
            </div>

            {/* 二进制示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">二进制数据方式</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`# cURL 示例
curl -X POST '${apiUrl}?op=merge' \\
  -H 'Content-Type: image/jpeg' \\
  --data-binary '@image.jpg' \\
  --output merged.png

# JavaScript fetch 示例
const blob = await fetch('image.jpg').then(r => r.blob());

const response = await fetch('${apiUrl}?op=merge', {
  method: 'POST',
  headers: { 'Content-Type': 'image/jpeg' },
  body: blob,
});`}</code></pre>
              </div>
            </div>

            {/* JSON Base64 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">JSON + Base64 方式</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`# cURL 示例
curl -X POST '${apiUrl}?op=merge' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "images": [
      "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      "iVBORw0KGgoAAAANSUhEUgAA..."
    ]
  }' \\
  --output merged.png

# JavaScript fetch 示例
const base64Images = await Promise.all([
  fileToBase64(file1),
  fileToBase64(file2),
]);

const response = await fetch('${apiUrl}?op=merge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ images: base64Images }),
});

// 辅助函数
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}`}</code></pre>
              </div>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">响应说明</h3>
            
            {/* 成功响应 - 文件类型 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200) - 文件类型</p>
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
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>响应头包含 <code className="bg-background px-1.5 py-0.5 rounded text-xs">X-Image-Count</code> (图片数量) 和 <code className="bg-background px-1.5 py-0.5 rounded text-xs">X-Processing-Time</code> (处理耗时)</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* 成功响应 - URL类型 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200) - URL类型 (returnType=url)</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`{
  "message": "图片拼接成功",
  "url": "https://your-domain.com/api/tools/file-share?op=download&fileId=550e8400-e29b-41d4-a716-446655440000",
  "fileId": "550e8400-e29b-41d4-a716-446655440000"
}`}</code></pre>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Content-Type: <code className="bg-background px-1.5 py-0.5 rounded text-xs">application/json</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>返回包含完整域名的图片访问 URL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>URL 对应的文件已通过文件分享工具保存</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>如果上传者是匿名用户，文件 24 小时后自动删除</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>响应头同样包含 <code className="bg-background px-1.5 py-0.5 rounded text-xs">X-Image-Count</code> 和 <code className="bg-background px-1.5 py-0.5 rounded text-xs">X-Processing-Time</code></span>
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
                <pre className="text-sm text-slate-50"><code>{`// 400 Bad Request - 没有上传图片
{
  "error": "没有上传图片",
  "message": "请使用 FormData 格式上传图片，参数名为 image0, image1, image2..."
}

// 400 Bad Request - 图片数量超限
{
  "error": "图片数量超出限制",
  "message": "最多支持上传 20 张图片，当前上传了 25 张"
}

// 400 Bad Request - 不支持的内容类型
{
  "error": "不支持的内容类型",
  "message": "支持的上传方式：1) FormData (multipart/form-data) 2) 二进制数据 (image/*) 3) JSON (application/json with base64)"
}

// 500 Internal Server Error
{
  "error": "图片拼接失败",
  "message": "无法获取图片尺寸",
  "timestamp": "2025-11-22T10:30:45.123Z"
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
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">上传方式对比</h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">方式</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">多图片</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">适用场景</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">数据大小</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    <tr>
                      <td className="px-4 py-2 font-mono">FormData</td>
                      <td className="px-4 py-2"><Badge variant="default" className="text-xs">支持</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground">浏览器、标准 HTTP 客户端</td>
                      <td className="px-4 py-2 text-muted-foreground">大文件友好</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono">二进制</td>
                      <td className="px-4 py-2"><Badge variant="secondary" className="text-xs">单图</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground">简单场景、流式传输</td>
                      <td className="px-4 py-2 text-muted-foreground">大文件友好</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono">JSON Base64</td>
                      <td className="px-4 py-2"><Badge variant="default" className="text-xs">支持</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground">API 调用、JSON-only 客户端</td>
                      <td className="px-4 py-2 text-muted-foreground">增加 33%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-mono">JSON URL</td>
                      <td className="px-4 py-2"><Badge variant="default" className="text-xs">支持</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground">网络图片、远程资源</td>
                      <td className="px-4 py-2 text-muted-foreground">仅下载耗时</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">通用说明</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>FormData 方式：文件参数名为 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">image0</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">image1</code>...，URL参数名为 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">imageUrl0</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">imageUrl1</code>...</span>
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
                  <span>最多支持上传 20 张图片</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持跨域调用（CORS enabled）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持网络图片URL，可与本地文件混合使用</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持返回类型选择：默认返回图片文件，可选择返回访问URL</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}