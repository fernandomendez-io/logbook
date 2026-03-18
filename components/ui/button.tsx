'use client'

import { cn } from '@/lib/utils/cn'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-green-muted text-[#080d08] hover:bg-green-primary active:scale-95 shadow-sm': variant === 'primary',
            'bg-surface-raised text-foreground border border-border hover:border-green-dim hover:text-green-primary': variant === 'secondary',
            'hover:bg-surface-raised hover:text-green-primary text-foreground/70': variant === 'ghost',
            'border border-red-500/50 text-red-400 hover:bg-red-500/10': variant === 'danger',
            'border border-border text-foreground hover:border-green-dim': variant === 'outline',
          },
          {
            'text-xs px-2.5 py-1.5': size === 'sm',
            'text-sm px-4 py-2': size === 'md',
            'text-base px-5 py-2.5': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
