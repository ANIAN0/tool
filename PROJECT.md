# 项目说明

## 基本信息

- **项目名称**: 功能工具箱
- **技术栈**: Next.js 16.0.3
- **部署平台**: Vercel
- **开发环境**: Windows
- **包管理器**: npm

---

## 功能清单

### 1. 图片拼接工具 (image-merger)

#### 功能说明
将多张图片按800px宽度从上到下拼接为一张图片，支持PNG格式输出。

#### 页面访问
- **路径**: `/public-tools/image-merger`
- **完整URL**: https://your-domain.com/public-tools/image-merger

#### 页面功能
- ✅ 支持多张图片上传（JPG、PNG、WebP等格式）
- ✅ 实时图片预览
- ✅ 图片顺序调整（上移/下移按钮）
- ✅ 单个删除/批量清空
- ✅ 实时拼接预览
- ✅ 结果下载（PNG格式）

#### API接口

**接口地址**: `/api/tools/image-merger?op=merge`

**请求方式**: POST

**请求格式**: `multipart/form-data`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| op | string | 是 | 操作类型，固定值: `merge` |
| image0, image1, ... | File | 是 | 图片文件，支持多个 |

**请求示例**:
```bash
curl -X POST 'https://your-domain.com/api/tools/image-merger?op=merge' \
  -F 'image0=@/path/to/image1.jpg' \
  -F 'image1=@/path/to/image2.png' \
  -F 'image2=@/path/to/image3.jpg' \
  --output merged.png
```

**JavaScript示例**:
```javascript
const formData = new FormData();
formData.append('image0', file1);
formData.append('image1', file2);

const response = await fetch('/api/tools/image-merger?op=merge', {
  method: 'POST',
  body: formData,
});

const blob = await response.blob();
const url = URL.createObjectURL(blob);
// 下载或显示图片
```

**成功响应** (200):
- Content-Type: `image/png`
- Body: PNG图片二进制数据
- 所有图片按上传顺序从上到下拼接
- 宽度统一缩放至800px，保持原始宽高比

**错误响应**:
```json
// 400 Bad Request
{
  "error": "没有上传图片"
}

// 500 Internal Server Error
{
  "error": "图片拼接失败"
}
```

#### API文档
- **路径**: `/docs/api/image-merger`
- **内容**: 完整的API调用说明、参数表格、代码示例

---

## 待添加功能

（待规划）

---

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问应用
# 浏览器打开 http://localhost:3000
```

### 创建新工具

```bash
# 使用脚本快速创建
npm run new:tool

# 更新注册表
npm run build:registry
```

---

## 文档说明

本项目包含以下文档：

- `README.md` - 本文档，项目说明
- `REQUIREMENTS.md` - 需求文档
- `DEVELOPMENT.md` - 开发规范
