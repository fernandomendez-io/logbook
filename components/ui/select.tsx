'use client'

import { cn } from '@/lib/utils/cn'
import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150',
            error && 'border-red-500/70',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
