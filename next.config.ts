import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

// withEve 把 eve agent 和 Next.js 打包为单项目：
// dev 时 next dev 旁起 eve dev server，部署时 eve 路由同源挂载到 /eve/v1
// 默认查找 ./agent 目录（tool/agent 正好匹配），useEveAgent 无需配 host
export default withEve(nextConfig);
