'use client'

import { cn } from '@/lib/utils/cn'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          suppressHydrationWarning
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground',
            'placeholder:text-foreground/30',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150',
            error && 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-foreground/40">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
