/**
 * 根布局组件
 * 应用程序的顶级布局，包含全局样式和字体配置
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 配置Geist Sans字体（用于正文）
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 配置Geist Mono字体（用于代码和等宽文本）
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 页面元数据配置
export const metadata: Metadata = {
  title: "AI 对话助手",
  description: "基于Next.js和AI SDK的智能对话应用",
};

/**
 * 根布局组件
 * 提供应用程序的基本HTML结构和全局样式
 * 
 * @param props - 组件属性
 * @param props.children - 子组件内容
 * @returns 完整的HTML布局
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
