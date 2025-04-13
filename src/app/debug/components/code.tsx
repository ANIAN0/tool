import * as React from "react"
import { cn } from "@/lib/utils"

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode
}

const Code = React.forwardRef<HTMLPreElement, CodeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <pre
        ref={ref}
        className={cn(
          "rounded-md bg-muted px-4 py-3 font-mono text-sm",
          className
        )}
        {...props}
      >
        <code className="relative rounded bg-muted font-mono text-sm">
          {children}
        </code>
      </pre>
    )
  }
)

Code.displayName = "Code"

export { Code }