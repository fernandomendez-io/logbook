'use client'

import { cn } from '@/lib/utils/cn'

interface DateTimeUtcInputProps {
  label?: string
  hint?: string
  value: string            // "YYYY-MM-DDTHH:MM" or ""
  onChange: (value: string) => void
  className?: string
}

/**
 * Date + time pair that always shows 24-hour UTC time.
 * Avoids the AM/PM issue of <input type="datetime-local"> in US locales.
 */
export function DateTimeUtcInput({ label, hint, value, onChange, className }: DateTimeUtcInputProps) {
  const datePart = value?.slice(0, 10) ?? ''
  const timePart = value?.slice(11, 16) ?? ''

  function handleDate(d: string) {
    onChange(d && timePart ? `${d}T${timePart}` : d ? `${d}T` : '')
  }

  function handleTime(t: string) {
    // Accept only digits and colon, max length 5
    const cleaned = t.replace(/[^\d:]/g, '').slice(0, 5)
    // Auto-insert colon after 2 digits
    const formatted = cleaned.length >= 2 && !cleaned.includes(':')
      ? `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
      : cleaned
    onChange(datePart ? `${datePart}T${formatted}` : `T${formatted}`)
  }

  const labelId = label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={`${labelId}-date`} className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex gap-1">
        <input
          id={`${labelId}-date`}
          type="date"
          value={datePart}
          onChange={e => handleDate(e.target.value)}
          className={cn(
            'flex-1 min-w-0 bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150',
          )}
        />
        <input
          id={`${labelId}-time`}
          type="text"
          inputMode="numeric"
          value={timePart}
          onChange={e => handleTime(e.target.value)}
          placeholder="HH:MM"
          maxLength={5}
          className={cn(
            'w-20 bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground font-mono',
            'placeholder:text-foreground/30',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150',
          )}
        />
      </div>
      {hint && <p className="text-xs text-foreground/40">{hint}</p>}
    </div>
  )
}
