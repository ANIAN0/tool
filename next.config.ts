import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // Turso sync 依赖原生 .node 绑定，必须保持为服务端运行时外部包。
  serverExternalPackages: [
    "@tursodatabase/sync",
    "@tursodatabase/sync-common",
    "@tursodatabase/database-common",
    "@tursodatabase/serverless",
  ],
  // 优化包导入，减少打包体积
  experimental: {
    optimizePackageImports: ['@/lib/db', '@/lib/auth'],
  },
};

// 使用 withWorkflow 包装，启用 Workflow SDK 的 Next.js 集成
export default withWorkflow(nextConfig);
