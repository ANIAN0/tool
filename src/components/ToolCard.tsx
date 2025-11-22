'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ToolModule } from '@/lib/types';
import { Globe, Lock, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  tool: ToolModule;
}

export function ToolCard({ tool }: ToolCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const Icon = tool.type === 'private-tools' ? Lock : Globe;

  return (
    <div
      className={cn(
        "group relative rounded-lg border transition-all duration-200",
        isHovered 
          ? "border-foreground/20 bg-muted/50" 
          : "border-border bg-card hover:border-foreground/10"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/${tool.type}/${tool.id}`} className="block p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className={cn(
            "font-medium text-base transition-colors",
            isHovered ? "text-foreground" : "text-foreground/90"
          )}>
            {tool.name}
          </h3>
          <Icon 
            className={cn(
              "w-4 h-4 flex-shrink-0 ml-2 transition-colors",
              isHovered ? "text-foreground/60" : "text-muted-foreground"
            )} 
            strokeWidth={2} 
          />
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed min-h-[32px] mb-3">
          {tool.description}
        </p>
        
        {tool.tags && tool.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {tool.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <ArrowRight 
            className={cn(
              "w-3.5 h-3.5 transition-all duration-200",
              isHovered 
                ? "text-foreground/60 translate-x-0.5" 
                : "text-muted-foreground/40"
            )} 
            strokeWidth={2}
          />
        </div>
      </Link>

      {tool.docs.enabled && (
        <div className="border-t px-4 py-2.5">
          <Link
            href={`/docs/api/${tool.id}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <FileText className="w-3 h-3" strokeWidth={2} />
            <span>API 文档</span>
          </Link>
        </div>
      )}
    </div>
  );
}