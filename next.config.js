/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 构建时忽略 ESLint 错误
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

// 0.1.1加入