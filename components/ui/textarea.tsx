'use client'

import { cn } from '@/lib/utils/cn'
import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono',
            'placeholder:text-foreground/30',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150 resize-y',
            error && 'border-red-500/70',
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
Textarea.displayName = 'Textarea'
