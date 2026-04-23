import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // 优化包导入，减少打包体积
  experimental: {
    optimizePackageImports: ['@/lib/db', '@/lib/auth'],
  },
};

// 使用 withWorkflow 包装，启用 Workflow SDK 的 Next.js 集成
export default withWorkflow(nextConfig);
