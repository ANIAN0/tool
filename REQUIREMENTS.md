# 需求文档

## 本次需求
好的，现在我需要开发第2个工具，用于上传图片、视频、语音文件，生成临时url，文件超过24小时自动删除，在功能页面上可以上传文件，查看图片文件，下载文件，删除文件。
因为文件比较隐私，进入页面时，先进行登录验证，登录验证通过后才可访问。验证需要输入用户名和密码。将用户名:密码作为header，get请求http://124.156.205.61:5678/webhook/82a78108-5dbf-47e5-bf41-222ac0b408e3，请求成功后返回通过，则认证成功
请完成页面、接口和文档的开发。
---

## 上一次需求

按照规范，创建第1个工具：图片拼接。可以将上传的多张图片，按800px的宽度从上到下拼接为一张图片。需要提供功能页面和对外接口

**状态**: ✅ 已完成

---

## 上一次改动内容

### 第一期改动（图片拼接工具）

#### 1. 创建基础架构
- ✅ 创建 `src/lib/types.ts` - 定义核心类型
- ✅ 创建 `src/components/ToolCard.tsx` - 工具卡片组件
- ✅ 创建 `src/components/ToolLoading.tsx` - 加载组件
- ✅ 创建 `src/features/registry.ts` - 工具注册表

#### 2. 创建路由系统
- ✅ 创建 `src/app/(tools)/layout.tsx` - 工具页面布局
- ✅ 创建 `src/app/(tools)/[toolType]/[toolId]/page.tsx` - 动态工具路由
- ✅ 创建 `src/app/(tools)/[toolType]/[toolId]/loading.tsx` - 加载状态
- ✅ 创建 `src/app/api/tools/[toolId]/route.ts` - API路由
- ✅ 创建 `src/app/welcome/page.tsx` - 欢迎页
- ✅ 创建 `src/app/not-found.tsx` - 404页面
- ✅ 创建 `src/app/docs/api/[toolId]/page.tsx` - API文档页面
- ✅ 修改 `src/app/page.tsx` - 重定向到欢迎页

#### 3. 创建图片拼接工具
- ✅ 创建 `src/features/image-merger/index.ts` - 工具元数据
- ✅ 创建 `src/features/image-merger/components/Main.tsx` - 前端界面
  - 支持多图上传
  - 图片预览
  - 顺序调整（上移/下移）
  - 图片删除
  - 实时拼接
  - 结果下载
- ✅ 创建 `src/features/image-merger/lib/api.ts` - API实现
  - 使用 sharp 库处理图片
  - 800px 宽度缩放
  - PNG 格式输出

#### 4. 开发工具脚本
- ✅ 创建 `scripts/generate-tool.js` - 快速创建新工具
- ✅ 创建 `scripts/update-registry.ts` - 自动更新注册表

#### 5. 配置更新
- ✅ 更新 `package.json`
  - 添加 sharp 依赖
  - 添加 ts-node 开发依赖
  - 添加 npm 脚本（new:tool, build:registry）
- ✅ 更新 `next.config.ts` - 添加生产环境配置
- ✅ 创建 `vercel.json` - Vercel部署配置
