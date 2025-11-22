import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wrench } from 'lucide-react';

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/welcome" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Wrench className="w-4 h-4 text-primary" strokeWidth={2} />
              </div>
              <span className="text-lg font-semibold text-foreground">工具箱</span>
            </Link>
            <Link href="/welcome">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <main>
        {children}
      </main>
    </div>
  );
}
