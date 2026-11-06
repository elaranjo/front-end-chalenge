// Adapted from https://ui.shadcn.com/r/styles/new-york-v4/input.json
import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(className)}
      {...props}
    />
  )
}

export { Input }
