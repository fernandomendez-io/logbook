import type { Database } from '@/lib/supabase/types'

type Sequence = Pick<
  Database['public']['Tables']['sequences']['Row'],
  'id' | 'sequence_number' | 'status' | 'report_date' | 'release_date'
>
type Flight = Pick<
  Database['public']['Tables']['flights']['Row'],
  'id' | 'scheduled_out_utc'
>

export interface CalendarDay {
  date: string            // YYYY-MM-DD
  isCurrentMonth: boolean
  sequences: { id: string; number: string; status: string }[]
  flightCount: number
  isDayOff: boolean
}

/** Format a Date as YYYY-MM-DD in UTC */
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Parse YYYY-MM-DD to a UTC midnight Date */
function parseDate(str: string): Date {
  return new Date(str + 'T00:00:00Z')
}

/**
 * Build a 5- or 6-week Sunday-anchored calendar grid for the given year/month.
 * Returns 35 or 42 CalendarDay objects.
 */
export function buildCalendarGrid(
  year: number,
  month: number, // 1-based
  sequences: Sequence[],
  flights: Flight[],
): CalendarDay[] {
  // First day of the month
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  // Start grid on the Sunday at or before the first day
  const startDay = new Date(firstOfMonth)
  startDay.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay())

  // Build flight-date map: YYYY-MM-DD → count
  const flightsByDate = new Map<string, number>()
  for (const f of flights) {
    const d = toDateStr(new Date(f.scheduled_out_utc))
    flightsByDate.set(d, (flightsByDate.get(d) ?? 0) + 1)
  }

  const days: CalendarDay[] = []
  const cursor = new Date(startDay)

  // Always render at least 5 weeks (35 cells), extend to 6 (42) if the month needs it
  const lastOfMonth = new Date(Date.UTC(year, month - 1 + 1, 0))
  const totalCells = lastOfMonth.getUTCDay() === 6 ? 42 : Math.max(35,
    Math.ceil((firstOfMonth.getUTCDay() + lastOfMonth.getUTCDate()) / 7) * 7
  )

  for (let i = 0; i < totalCells; i++) {
    const dateStr = toDateStr(cursor)
    const isCurrentMonth = cursor.getUTCMonth() === month - 1

    // Find sequences that include this date
    const daySequences = sequences
      .filter(s => {
        const start = parseDate(s.report_date)
        const end = parseDate(s.release_date)
        const day = parseDate(dateStr)
        return day >= start && day <= end
      })
      .map(s => ({ id: s.id, number: s.sequence_number, status: s.status }))

    const flightCount = flightsByDate.get(dateStr) ?? 0
    const isDayOff = daySequences.length === 0 && flightCount === 0

    days.push({ date: dateStr, isCurrentMonth, sequences: daySequences, flightCount, isDayOff })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

/** Add or subtract months from a YYYY-MM string */
export function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Format YYYY-MM as "March 2025" */
export function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
