# 进展

重构项目，尝试用 chatbot 形式。

## 主入口与对话

- 主对话路由：**`/agent-chat`**（新会话）、**`/agent-chat/[id]`**（已有会话）。
- 旧 **`/chat`**、**`/api/chat`** 已移除；未配置重定向，直接访问旧 URL 为 **404**。

## 文档（本地）

设计与计划见 **`docs/superpowers/`**。产品向说明写在 **`docs/项目最新概况/`**（`01`～`07`），因 `.gitignore` 默认忽略 `docs/**`（仅放行 `docs/superpowers`），该目录多为**本地留存**；若需纳入版本库请调整 `.gitignore`。

- `01登录注册鉴权说明.md` — 鉴权、匿名、`migrateMcpData`、可选鉴权 API
- `02模型配置说明.md` — user_models、OpenRouter / OpenAI-Compatible
- `03mcp与mcptool注册说明.md` — MCP CRUD、匿名、`authenticateRequestOptional`
- `04系统内置tool说明.md` — `SYSTEM_TOOLS`、`enabledSystemTools`
- `05沙盒服务与对接说明.md` — 沙盒部署与 Next 对接（替代原「沙盒服务部署实施文档」）
- `06agent配置说明.md` — Agent API 与设置页
- `07agentchat页面说明.md` — Agent Chat 前后端

## 开发与校验

```bash
npm install
npm run build
```

（`npm run lint` 当前仓库内尚有既有告警/错误，与本次变更无必然关系。）
