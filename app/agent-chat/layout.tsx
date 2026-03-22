/**
 * AgentChat页面布局
 * 提供全屏容器
 */

export default function AgentChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}