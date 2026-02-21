/**
 * 首页组件
 * 应用程序的欢迎页面，提供快速导航和说明
 */

import Image from "next/image";
import Link from "next/link";

/**
 * 首页组件
 * 显示应用程序的欢迎信息、快速开始指南和导航选项
 * 
 * @returns 渲染后的首页
 */
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-24 px-6 sm:px-8">
        {/* Next.js 标志 */}
        <Image
          className="dark:invert mb-8"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        
        {/* 主要内容区域 */}
        <div className="flex-1 flex flex-col items-center gap-8 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-foreground sm:text-4xl">
            AI 对话助手
          </h1>
          <p className="max-w-md text-lg leading-8 text-muted-foreground sm:text-xl">
            基于Next.js和AI SDK的智能对话应用。支持多轮对话、历史对话管理和模型选择功能。
          </p>
          
          {/* 导航按钮 */}
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row sm:gap-6">
            {/* 开始聊天按钮 */}
            <Link
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-primary-foreground transition-all hover:bg-primary/90 sm:w-[160px]"
              href="/chat"
            >
              开始聊天
            </Link>
            
            {/* 文档链接 */}
            <a
              className="flex h-12 w-full items-center justify-center rounded-md border border-input bg-background px-6 text-foreground transition-all hover:bg-accent sm:w-[160px]"
              href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              文档
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
