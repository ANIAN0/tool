/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 警告：这会禁用构建时的 ESLint 检查
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https', // 将原来的'blob'改为'https'
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig