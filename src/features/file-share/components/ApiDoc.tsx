'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Send,
  CheckCircle2,
  XCircle,
  Info,
  FileCode,
  Upload,
  Download,
  Trash2,
  List
} from 'lucide-react';

export default function FileShareApiDoc({ tool }: { tool: any }) {
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
          <CardDescription>文件分享工具 API 端点信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">基础URL</p>
              <code className="block text-sm bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {apiUrl}
              </code>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">认证方式</p>
              <Badge variant="default" className="bg-blue-600">
                Password Header
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 上传文件接口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" strokeWidth={2} />
            上传文件
          </CardTitle>
          <CardDescription>上传一个或多个文件，生成临时访问链接</CardDescription>
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
                    <td className="px-4 py-3 text-sm font-mono text-foreground">file0, file1...</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">File</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-xs">是</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      文件对象，支持图片、视频、音频等格式
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            
            {/* cURL 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">cURL 示例</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`# 上传单个文件
curl -X POST '${apiUrl}/upload' \\
  -H 'password: your_password' \\
  -F 'file0=@/path/to/image.jpg' \\
  --output response.json

# 上传多个文件
curl -X POST '${apiUrl}/upload' \\
  -H 'password: your_password' \\
  -F 'file0=@/path/to/image.jpg' \\
  -F 'file1=@/path/to/video.mp4' \\
  -F 'file2=@/path/to/audio.mp3' \\
  --output response.json`}</code></pre>
              </div>
            </div>

            {/* JavaScript 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">JavaScript fetch 示例</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`// 上传文件
const formData = new FormData();
formData.append('file0', file1);
formData.append('file1', file2);

const response = await fetch('${apiUrl}/upload', {
  method: 'POST',
  headers: {
    'password': 'your_password'
  },
  body: formData,
});

const result = await response.json();
console.log('上传成功:', result.files);`}</code></pre>
              </div>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">响应说明</h3>
            
            {/* 成功响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200)</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`{
  "message": "文件上传成功",
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "example.jpg",
      "type": "image/jpeg",
      "size": 102400,
      "url": "/api/tools/file-share/download/550e8400-e29b-41d4-a716-446655440000",
      "expiresAt": "2025-11-27T10:30:00.000Z",
      "uploadedAt": "2025-11-26T10:30:00.000Z"
    }
  ]
}`}</code></pre>
              </div>
            </div>
            
            {/* 错误响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">错误响应</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`// 401 Unauthorized - 认证失败
{
  "error": "未授权访问"
}

// 500 Internal Server Error - 上传失败
{
  "error": "文件上传失败"
}`}</code></pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 下载文件接口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" strokeWidth={2} />
            下载文件
          </CardTitle>
          <CardDescription>通过文件ID下载已上传的文件</CardDescription>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">位置</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">必填</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">说明</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">fileId</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">URL路径</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-xs">是</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      文件唯一标识符
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            
            {/* cURL 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">cURL 示例</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`curl -X GET '${apiUrl}/download/550e8400-e29b-41d4-a716-446655440000' \\
  -H 'password: your_password' \\
  --output downloaded-file.jpg`}</code></pre>
              </div>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-3">
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
                    <span>返回文件二进制数据</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Content-Type 根据文件类型自动设置</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Content-Disposition 包含原始文件名</span>
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
                <pre className="text-sm text-slate-50"><code>{`// 401 Unauthorized - 认证失败
{
  "error": "未授权访问"
}

// 404 Not Found - 文件不存在
{
  "error": "文件不存在"
}

// 410 Gone - 文件已过期
{
  "error": "文件已过期"
}`}</code></pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 删除文件接口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-primary" strokeWidth={2} />
            删除文件
          </CardTitle>
          <CardDescription>通过文件ID删除已上传的文件</CardDescription>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">位置</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">必填</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">说明</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-foreground">fileId</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">URL路径</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive" className="text-xs">是</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      文件唯一标识符
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            
            {/* cURL 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">cURL 示例</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`curl -X DELETE '${apiUrl}/delete/550e8400-e29b-41d4-a716-446655440000' \\
  -H 'password: your_password'`}</code></pre>
              </div>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">响应说明</h3>
            
            {/* 成功响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200)</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`{
  "message": "文件删除成功",
  "fileId": "550e8400-e29b-41d4-a716-446655440000"
}`}</code></pre>
              </div>
            </div>
            
            {/* 错误响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">错误响应</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`// 401 Unauthorized - 认证失败
{
  "error": "未授权访问"
}

// 404 Not Found - 文件不存在
{
  "error": "文件不存在"
}`}</code></pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 获取文件列表接口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="w-5 h-5 text-primary" strokeWidth={2} />
            获取文件列表
          </CardTitle>
          <CardDescription>获取当前用户所有有效的文件列表</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 请求示例 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">请求示例</h3>
            
            {/* cURL 示例 */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">cURL 示例</p>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`curl -X GET '${apiUrl}/list' \\
  -H 'password: your_password'`}</code></pre>
              </div>
            </div>
          </div>

          {/* 响应说明 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">响应说明</h3>
            
            {/* 成功响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">成功响应 (200)</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`{
  "message": "获取文件列表成功",
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "example.jpg",
      "type": "image/jpeg",
      "size": 102400,
      "url": "/api/tools/file-share/download/550e8400-e29b-41d4-a716-446655440000",
      "expiresAt": "2025-11-27T10:30:00.000Z",
      "uploadedAt": "2025-11-26T10:30:00.000Z"
    }
  ]
}`}</code></pre>
              </div>
            </div>
            
            {/* 错误响应 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" strokeWidth={2} />
                <p className="text-sm font-semibold text-foreground">错误响应</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-slate-50"><code>{`// 401 Unauthorized - 认证失败
{
  "error": "未授权访问"
}

// 500 Internal Server Error
{
  "error": "获取文件列表失败"
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
              <h4 className="text-sm font-semibold text-foreground mb-2">认证说明</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>所有接口都需要密码认证</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>认证地址：http://124.156.205.61:5678/webhook/82a78108-5dbf-47e5-bf41-222ac0b408e3</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>请求头中包含 password 字段</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>认证成功返回文本：通过</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">文件管理</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>文件上传后24小时自动删除</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持图片、视频、音频等多种格式文件</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>可通过API或Web界面管理文件</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>文件下载时会保持原始文件名</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">安全说明</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>所有接口均需认证后访问</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>文件ID为UUID格式，难以猜测</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>过期文件会自动清理</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}