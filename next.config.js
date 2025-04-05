/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 启用 ESLint 缓存
    cache: true,
  },
  // 移除不需要的图片域名白名单配置
}

module.exports = nextConfig

// 0.1.1加入