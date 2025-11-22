'use client';

import Link from 'next/link';
import type { ToolModule } from '@/lib/types';

interface ToolCardProps {
  tool: ToolModule;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <div className="group border rounded-lg p-4 hover:shadow-lg transition-all bg-white">
      <Link href={`/${tool.type}/${tool.id}`} className="block">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">
              {tool.name}
            </h3>
            <p className="text-sm text-gray-600 mt-2 min-h-[40px]">
              {tool.description}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {tool.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-4 text-2xl">
            {tool.icon || (tool.type === 'private-tools' ? '🔒' : '🌐')}
          </div>
        </div>
      </Link>
      {tool.docs.enabled && (
        <div className="mt-3 pt-3 border-t">
          <Link
            href={`/docs/api/${tool.id}`}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span>📄</span>
            <span>查看API文档</span>
          </Link>
        </div>
      )}
    </div>
  );
}
