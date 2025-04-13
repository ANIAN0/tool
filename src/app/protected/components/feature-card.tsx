"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface FeatureCardProps {
  id: string
  name: string
  description?: string
  updatedAt: string
  url: string
}

export function FeatureCard({ id, name, description, updatedAt, url }: FeatureCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link
      href={url}
      target="_blank"
      className={cn(
        "group relative flex flex-col h-[150px] p-4 rounded-lg border",
        "transition-all duration-300",
        isHovered ? "bg-muted border-muted-foreground/20" : ""
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 移除了右上角打开提示 */}

      <div className="space-y-2 mb-auto">
        <h3 className={cn(
          "font-semibold transition-colors",
          isHovered ? "text-primary" : "text-foreground"
        )}>
          {name}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </div>
      
      <div className="pt-4 mt-2 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            更新于 {new Date(updatedAt).toLocaleDateString()}
          </span>
          <svg 
            className={cn(
              "w-4 h-4 transition-opacity",
              isHovered ? "opacity-100" : "opacity-0"
            )}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M14 5l7 7m0 0l-7 7m7-7H3" 
            />
          </svg>
        </div>
      </div>
    </Link>
  )
}
