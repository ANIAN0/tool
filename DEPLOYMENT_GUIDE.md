# Vercel 部署指南

## 1. 本地测试

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:3000`

### 测试功能
1. **文件分享工具**
   - 登录（默认密码：根据你的认证系统）
   - 上传文件
   - 下载/预览文件
   - 删除文件
   - 查看文件列表

2. **图片拼接工具**
   - 上传多张图片
   - 测试"文件"返回模式
   - 测试"URL"返回模式（调用文件上传接口）
   - 验证返回的 URL 可访问

### 验证 Supabase 连接
检查浏览器开发工具的网络标签，确保：
- API 请求成功（200 状态码）
- 数据库查询正常工作
- Storage 文件上传/下载正常

---

## 2. Vercel 部署准备

### 2.1 生成 Cron Job 密钥
```bash
# 在命令行生成一个随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将生成的值保存为 `CRON_SECRET`

### 2.2 在 Vercel 仪表板添加环境变量

1. 进入 Vercel 项目设置 → Environment Variables
2. 添加以下变量：

| 环境变量 | 值 |
|---------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tqzhnpaqrnbmwqlexgoi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_Sd2pB_vkb--awC88Vl-9dg_g1LLAP9P` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `CRON_SECRET` | （粘贴生成的密钥） |

### 2.3 Supabase Storage Bucket 权限

确保 `public.files` bucket 的权限设置正确：
- 访问级别：Public
- 允许上传：是
- 允许下载：是

在 Supabase 仪表板 → Storage → public.files → Policies 中验证 RLS 策略

---

## 3. 部署

### 方式 1：Git 推送（推荐）
```bash
git add .
git commit -m "Migrate to Supabase Storage and PostgreSQL"
git push
```

Vercel 会自动构建和部署

### 方式 2：Vercel CLI
```bash
vercel --prod
```

---

## 4. 部署后验证

### 4.1 检查构建日志
- Vercel 仪表板 → Deployments → 最新部署 → Logs
- 确保没有构建错误

### 4.2 测试已部署的应用
1. 访问 `https://your-app.vercel.app`
2. 测试文件上传/下载
3. 测试图片拼接
4. 检查浏览器控制台是否有错误

### 4.3 验证 Cron Job
- Vercel 仪表板 → Crons
- 应该看到 `cleanup-expired-files` 任务已启用
- 可以手动触发测试

---

## 5. 故障排查

### 文件上传失败
**错误信息**: `FUNCTION_PAYLOAD_TOO_LARGE`
- **原因**: 文件太大或请求体太大
- **解决**: 检查文件大小（限制 100MB）

**错误信息**: `Storage bucket not found`
- **原因**: Supabase bucket 名称错误或权限问题
- **解决**: 验证 bucket 名称是 `public.files`，检查 RLS 策略

### 文件下载返回 404
**原因**: 文件已过期或数据库/Storage 不同步
- **解决**: 检查文件是否已过期，验证 Supabase 连接

### Cron Job 未执行
**检查**: Vercel 仪表板 → Crons → Function logs
- 确保 `CRON_SECRET` 环境变量已设置
- 查看 Cron logs 了解执行状态

---

## 6. 性能优化建议

1. **启用 Supabase CDN**: 在 Supabase 仪表板 → Storage 中启用 CDN 缓存
2. **优化图片压缩**: 在 `image-merger/lib/api.ts` 中调整 JPEG 质量参数
3. **使用 Vercel 缓存**: 配置合适的缓存策略

---

## 7. 监控和日志

### 查看 Supabase 日志
- Supabase 仪表板 → Logs → Database
- 检查是否有 SQL 错误

### 查看 Vercel 日志
- Vercel 仪表板 → Deployments → Real-time Logs
- 监控运行时错误

---

## 附录：SQL 创建语句

如果需要重新创建表，在 Supabase SQL Editor 中执行：

```sql
-- 创建 file_uploads 表
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_file_uploads_expires_at ON file_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at);

-- 启用 RLS 政策
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- 允许公开读取
CREATE POLICY "Allow public read" ON file_uploads FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON file_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role delete" ON file_uploads FOR DELETE USING (true);
```
