'use client'

import { cn } from '@/lib/utils/cn'

interface ActualTimeInputProps {
  label: string
  hint?: string
  /** Current value "YYYY-MM-DDTHH:MM" or "" */
  value: string
  onChange: (value: string) => void
  /**
   * The scheduled departure date in UTC "YYYY-MM-DD" — used to pre-fill the day
   * and resolve month rollovers. Pass scheduledOutUtc.slice(0, 10).
   */
  referenceDate?: string
}

/**
 * Compact actual-time input for ACARS OUT/OFF/ON/IN fields.
 * Shows only a day number + HH:MM field (both UTC).
 * The month/year is inferred from referenceDate with rollover logic:
 *   if |entered day − reference day| > 15, we crossed a month boundary.
 */
export function ActualTimeInput({ label, hint, value, onChange, referenceDate }: ActualTimeInputProps) {
  const datePart = value?.slice(0, 10) ?? ''
  const timePart = value?.slice(11, 16) ?? ''

  // Determine current display day from value, falling back to referenceDate
  const displayDay = datePart
    ? String(parseInt(datePart.slice(8, 10), 10))
    : referenceDate
    ? String(parseInt(referenceDate.slice(8, 10), 10))
    : ''

  function resolveDate(day: number): string {
    const ref = referenceDate || datePart || ''
    if (!ref) return ''
    const refYear = parseInt(ref.slice(0, 4), 10)
    const refMonth = parseInt(ref.slice(5, 7), 10) - 1 // 0-indexed
    const refDay = parseInt(ref.slice(8, 10), 10)
    const diff = day - refDay

    let year = refYear
    let month = refMonth

    if (diff > 15) {
      // Day jumped forward by more than half a month → previous month
      month -= 1
      if (month < 0) { month = 11; year -= 1 }
    } else if (diff < -15) {
      // Day dropped by more than half a month → next month
      month += 1
      if (month > 11) { month = 0; year += 1 }
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const clampedDay = Math.min(Math.max(day, 1), daysInMonth)
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
  }

  function handleDay(raw: string) {
    const day = parseInt(raw, 10)
    if (isNaN(day) || day < 1 || day > 31) {
      // Clear value if invalid, keep time
      onChange(timePart ? `T${timePart}` : '')
      return
    }
    const resolved = resolveDate(day)
    onChange(resolved ? `${resolved}T${timePart}` : timePart ? `T${timePart}` : '')
  }

  function handleTime(raw: string) {
    const cleaned = raw.replace(/[^\d:]/g, '').slice(0, 5)
    const formatted = cleaned.length >= 2 && !cleaned.includes(':')
      ? `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
      : cleaned
    const resolvedDate = datePart || (referenceDate ?? '')
    onChange(resolvedDate ? `${resolvedDate}T${formatted}` : `T${formatted}`)
  }

  const labelId = label.toLowerCase().replace(/[^a-z0-9]/g, '-')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${labelId}-time`} className="text-xs font-medium text-foreground/60 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-1">
        {/* Day input — narrow, numeric */}
        <input
          id={`${labelId}-day`}
          type="number"
          min={1}
          max={31}
          value={displayDay}
          onChange={e => handleDay(e.target.value)}
          placeholder="DD"
          className={cn(
            'w-14 bg-surface border border-border rounded-md px-2 py-2 text-sm text-foreground font-mono text-center',
            'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
            'transition-colors duration-150',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />
        {/* HH:MM input */}
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
