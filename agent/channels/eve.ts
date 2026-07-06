// eve channel 定义：暴露 /eve/v1 路由供 Next.js 内部调用与本地应用调用
import { createHash, timingSafeEqual } from "node:crypto";
import { eveChannel } from "eve/channels/eve";
import {
  extractBearerToken,
  localDev,
  UnauthenticatedError,
  type AuthFn,
} from "eve/channels/auth";
import type { SessionAuthContext } from "eve/context";

// 与同部署的 Next.js 服务端共享同一环境变量；内部调用与外部本地应用都带此 key
const AGENT_API_KEY = process.env.AGENT_API_KEY?.trim() ?? "";

// 是否处于 Vercel 部署环境（production / preview），排除 vercel dev 本地
// 与 localDev() 的判断对称：localDev 放行 development，这里在非 development 报错
const IS_VERCEL_DEPLOYMENT =
  Boolean(process.env.VERCEL) && process.env.VERCEL_ENV !== "development";

// 恒定时间比较：先 SHA-256 归一化为固定 32 字节摘要再比较
// 既避免时序侧信道泄露 key 内容，也避免长度差异泄露 key 长度
function safeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

// 自定义 AuthFn：校验 Authorization: Bearer <AGENT_API_KEY>
// 通过 → 返回 service principal；不通过 → 返回 null 交给下一个策略（localDev）
function apiKeyAuth(): AuthFn<Request> {
  return (request) => {
    // key 未配置：部署环境 fail-fast 抛明确错误，让部署者立刻发现配置缺失；
    // 本地开发则跳过（返回 null），交给 localDev 兜底放行
    if (AGENT_API_KEY.length === 0) {
      if (IS_VERCEL_DEPLOYMENT) {
        throw new UnauthenticatedError({
          code: "eve_api_key_not_configured",
          message:
            "AGENT_API_KEY is not configured. Set it in Vercel env vars (Production + Preview).",
        });
      }
      return null;
    }
    const token = extractBearerToken(request.headers.get("authorization"));
    if (token === null) return null;
    if (!safeEqual(token, AGENT_API_KEY)) return null;
    return {
      attributes: {},
      authenticator: "api-key",
      principalId: "api-key",
      principalType: "service",
    } satisfies SessionAuthContext;
  };
}

export default eveChannel({
  auth: [apiKeyAuth(), localDev()],
  uploadPolicy: "disabled",
});
