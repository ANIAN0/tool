import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 优化包导入，减少打包体积
  experimental: {
    optimizePackageImports: ['@/lib/db', '@/lib/auth'],
  },
};

export default nextConfig;
