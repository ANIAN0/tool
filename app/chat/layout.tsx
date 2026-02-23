/**
 * 对话页面布局
 * 提供全屏容器，确保页面内容占满视口高度
 */

import { AuthProvider } from "@/components/auth/auth-provider";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 全屏高度，确保内容占满视口
    <div className="h-screen overflow-hidden bg-background">
      <AuthProvider>
        {children}
      </AuthProvider>
    </div>
  );
}
