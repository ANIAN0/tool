import { notFound } from 'next/navigation';
import { getToolMetadata, getAllTools } from '@/features/registry';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/welcome" className="text-xl font-bold text-gray-800 hover:text-blue-600">
                🛠️ 工具箱
              </Link>
              <span className="mx-3 text-gray-400">/</span>
              <span className="text-gray-600">API文档</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={`/${tool.type}/${tool.id}`}
                className="text-blue-600 hover:text-blue-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                使用工具
              </Link>
              <Link
                href="/welcome"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* 工具信息 */}
          <div className="border-b pb-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{tool.icon}</span>
              <h1 className="text-3xl font-bold text-gray-900">{tool.name}</h1>
            </div>
            <p className="text-lg text-gray-600 mt-2">{tool.description}</p>
            <div className="flex gap-2 mt-4">
              {tool.tags.map(tag => (
                <span
                  key={tag}
                  className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* API文档内容 - 根据toolId动态渲染 */}
          {toolId === 'image-merger' && <ImageMergerApiDoc tool={tool} />}
        </div>
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
      <section>
        <h2 className="text-2xl font-semibold mb-4">接口概览</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">接口地址</p>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{apiUrl}</code>
            </div>
            <div>
              <p className="text-sm text-gray-600">请求方式</p>
              <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-medium">
                POST
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 拼接图片接口 */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">拼接图片</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">请求参数</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">参数名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">必填</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">说明</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">op</td>
                    <td className="px-4 py-3 text-sm">string</td>
                    <td className="px-4 py-3 text-sm">是</td>
                    <td className="px-4 py-3 text-sm">操作类型，固定值: <code className="bg-gray-100 px-1 rounded">merge</code></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono">image0, image1...</td>
                    <td className="px-4 py-3 text-sm">File</td>
                    <td className="px-4 py-3 text-sm">是</td>
                    <td className="px-4 py-3 text-sm">图片文件，支持 JPG、PNG、WebP 等格式</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">请求示例</h3>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100"><code>{`# cURL 示例
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

          <div>
            <h3 className="text-lg font-medium mb-2">响应说明</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-700"><strong>成功响应 (200):</strong></p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
                <li>Content-Type: <code className="bg-gray-100 px-1 rounded">image/png</code></li>
                <li>返回拼接后的PNG图片二进制数据</li>
                <li>所有图片按上传顺序从上到下拼接</li>
                <li>宽度统一缩放至800px，保持原始宽高比</li>
              </ul>
              
              <p className="text-sm text-gray-700 mt-4"><strong>错误响应:</strong></p>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto mt-2">
                <pre className="text-sm text-gray-100"><code>{`// 400 Bad Request
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
        </div>
      </section>

      {/* 使用说明 */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">使用说明</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 支持同时上传多张图片，文件参数名为 <code className="bg-white px-1 rounded">image0</code>, <code className="bg-white px-1 rounded">image1</code>, <code className="bg-white px-1 rounded">image2</code> ...</li>
            <li>• 图片将按参数顺序从上到下拼接</li>
            <li>• 所有图片会被缩放至 800px 宽度，高度按比例计算</li>
            <li>• 支持常见图片格式：JPG、PNG、WebP、GIF 等</li>
            <li>• 输出格式固定为 PNG，支持透明背景</li>
            <li>• 请求需使用 <code className="bg-white px-1 rounded">multipart/form-data</code> 格式</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
