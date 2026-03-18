'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { utcDtToLocal, localDtToUtc } from '@/lib/utils/timezone'

interface ActualTimeInputProps {
  label: string
  hint?: string
  /** Current value "YYYY-MM-DDTHH:MM" or "" — always UTC */
  value: string
  onChange: (value: string) => void
  /**
   * The scheduled departure date in UTC "YYYY-MM-DD" — used to pre-fill the day
   * and resolve month rollovers. Pass scheduledOutUtc.slice(0, 10).
   */
  referenceDate?: string
  /** IANA timezone string — when provided, shows a second local-time row */
  timezone?: string
  /** Short abbreviation to label the local row, e.g. "CDT", "EST" */
  timezoneAbbr?: string
}

/**
 * Compact actual-time input for ACARS OUT/OFF/ON/IN fields.
 * Shows a UTC row (always) and an optional local-timezone row.
 * The month/year is inferred from referenceDate with rollover logic:
 *   if |entered day − reference day| > 15, we crossed a month boundary.
 */
export function ActualTimeInput({
  label,
  hint,
  value,
  onChange,
  referenceDate,
  timezone,
  timezoneAbbr,
}: ActualTimeInputProps) {
  // UTC-derived display values
  const datePart = value?.slice(0, 10) ?? ''
  const timePart = value?.slice(11, 16) ?? ''
  const displayDay = datePart
    ? String(parseInt(datePart.slice(8, 10), 10))
    : referenceDate
    ? String(parseInt(referenceDate.slice(8, 10), 10))
    : ''

  // Local row draft — non-null only while user is actively editing the local row
  const [localDraft, setLocalDraft] = useState<{ day: string; time: string } | null>(null)

  // Derived local display from the UTC value
  const localValue = useMemo(() => {
    if (!timezone || !value) return { datePart: '', timePart: '', displayDay: '' }
    const dt = utcDtToLocal(value, timezone)
    if (!dt) return { datePart: '', timePart: '', displayDay: '' }
    return {
      datePart: dt.slice(0, 10),
      timePart: dt.slice(11, 16),
      displayDay: String(parseInt(dt.slice(8, 10), 10)),
    }
  }, [value, timezone])

  // Shared month-rollover resolver — ref is any "YYYY-MM-DD" string
  function resolveDayInMonth(day: number, ref: string): string {
    if (!ref) return ''
    const refYear  = parseInt(ref.slice(0, 4), 10)
    const refMonth = parseInt(ref.slice(5, 7), 10) - 1 // 0-indexed
    const refDay   = parseInt(ref.slice(8, 10), 10)
    const diff     = day - refDay

    let year  = refYear
    let month = refMonth

    if (diff > 15) {
      month -= 1
      if (month < 0) { month = 11; year -= 1 }
    } else if (diff < -15) {
      month += 1
      if (month > 11) { month = 0; year += 1 }
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const clampedDay  = Math.min(Math.max(day, 1), daysInMonth)
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
  }

  // ── UTC row handlers ──────────────────────────────────────────────────────

  function handleDay(raw: string) {
    const day = parseInt(raw, 10)
    if (isNaN(day) || day < 1 || day > 31) {
      onChange(timePart ? `T${timePart}` : '')
      return
    }
    const ref      = referenceDate || datePart
    const resolved = resolveDayInMonth(day, ref)
    onChange(resolved ? `${resolved}T${timePart}` : timePart ? `T${timePart}` : '')
  }

  function handleTime(raw: string) {
    const cleaned   = raw.replace(/[^\d:]/g, '').slice(0, 5)
    const formatted = cleaned.length >= 2 && !cleaned.includes(':')
      ? `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
      : cleaned
    const resolvedDate = datePart || (referenceDate ?? '')
    onChange(resolvedDate ? `${resolvedDate}T${formatted}` : `T${formatted}`)
  }

  // ── Local row handlers ────────────────────────────────────────────────────

  function flushLocalDraft(draft: { day: string; time: string }) {
    if (!timezone) return
    const dayNum = parseInt(draft.day, 10)
    if (isNaN(dayNum) || draft.time.length < 5 || !draft.time.includes(':')) return

    // Reconstruct local YYYY-MM-DDTHH:MM using local reference date
    const localRef = localValue.datePart ||
      (referenceDate ? utcDtToLocal(`${referenceDate}T00:00`, timezone).slice(0, 10) : '')
    if (!localRef) return

    const localDateStr = resolveDayInMonth(dayNum, localRef)
    if (!localDateStr) return

    const localDT = `${localDateStr}T${draft.time}`
    const utcResult = localDtToUtc(localDT, timezone)
    if (utcResult) onChange(utcResult)
  }

  function handleLocalDay(raw: string) {
    const draft = { day: raw, time: localDraft?.time ?? localValue.timePart }
    setLocalDraft(draft)
    flushLocalDraft(draft)
  }

  function handleLocalTime(raw: string) {
    const cleaned   = raw.replace(/[^\d:]/g, '').slice(0, 5)
    const formatted = cleaned.length >= 2 && !cleaned.includes(':')
      ? `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`
      : cleaned
    const draft = { day: localDraft?.day ?? localValue.displayDay, time: formatted }
    setLocalDraft(draft)
    flushLocalDraft(draft)
  }

  function clearLocalDraft() {
    setLocalDraft(null)
  }

  const labelId = label.toLowerCase().replace(/[^a-z0-9]/g, '-')

  const inputBase = cn(
    'bg-surface border border-border rounded-md px-2 py-2 text-sm font-mono text-center',
    'focus:outline-none focus:border-green-primary focus:ring-1 focus:ring-green-primary/30',
    'transition-colors duration-150',
  )

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`${labelId}-utc-time`}
        className="text-xs font-medium text-foreground/60 uppercase tracking-wider"
      >
        {label}
      </label>

      {/* UTC row */}
      <div className="flex items-center gap-1">
        <span className="w-8 text-xs font-mono text-foreground/30 text-right shrink-0 select-none">Z</span>
        <input
          id={`${labelId}-utc-day`}
          type="number"
          min={1}
          max={31}
          value={displayDay}
          onChange={e => handleDay(e.target.value)}
          placeholder="DD"
          className={cn(
            inputBase,
            'w-14 text-foreground',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />
        <input
          id={`${labelId}-utc-time`}
          type="text"
          inputMode="numeric"
          value={timePart}
          onChange={e => handleTime(e.target.value)}
          placeholder="HH:MM"
          maxLength={5}
          className={cn(inputBase, 'w-20 text-left px-3 placeholder:text-foreground/30 text-foreground')}
        />
      </div>

      {/* Local row — only when timezone is provided */}
      {timezone && (
        <div className="flex items-center gap-1">
          <span className="w-8 text-xs font-mono text-green-primary/50 text-right shrink-0 select-none">
            {timezoneAbbr ?? 'LT'}
          </span>
          <input
            id={`${labelId}-local-day`}
            type="number"
            min={1}
            max={31}
            value={localDraft?.day ?? localValue.displayDay}
            onChange={e => handleLocalDay(e.target.value)}
            onBlur={clearLocalDraft}
            placeholder="DD"
            className={cn(
              inputBase,
              'w-14 text-foreground/70',
              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            )}
          />
          <input
            id={`${labelId}-local-time`}
            type="text"
            inputMode="numeric"
            value={localDraft?.time ?? localValue.timePart}
            onChange={e => handleLocalTime(e.target.value)}
            onBlur={clearLocalDraft}
            placeholder="HH:MM"
            maxLength={5}
            className={cn(inputBase, 'w-20 text-left px-3 placeholder:text-foreground/30 text-foreground/70')}
          />
        </div>
      )}

      {hint && <p className="text-xs text-foreground/40">{hint}</p>}
    </div>
  )
}
