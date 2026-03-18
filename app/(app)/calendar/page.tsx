import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { buildCalendarGrid, shiftMonth, formatMonthLabel } from '@/lib/aviation/calendar'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-primary/20 text-green-primary border border-green-primary/30',
  dropped: 'bg-foreground/10 text-foreground/40 line-through border border-border',
  traded: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  reassigned: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve target month
  const nowYM = new Date().toISOString().slice(0, 7) // YYYY-MM
  const rawMonth = params.month ?? nowYM
  const [yearStr, monthStr] = rawMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const prevMonth = shiftMonth(rawMonth, -1)
  const nextMonth = shiftMonth(rawMonth, 1)
  const label = formatMonthLabel(rawMonth)

  // Fetch window: a bit wider than just the month (to fill partial weeks at edges)
  const windowStart = `${shiftMonth(rawMonth, -1)}-01`
  const windowEnd = `${shiftMonth(rawMonth, 1)}-28` // safe upper bound

  const [{ data: sequences }, { data: flights }] = await Promise.all([
    supabase
      .from('sequences')
      .select('id, sequence_number, status, report_date, release_date')
      .eq('pilot_id', user.id)
      .lte('report_date', windowEnd)
      .gte('release_date', windowStart),
    supabase
      .from('flights')
      .select('id, scheduled_out_utc')
      .eq('pilot_id', user.id)
      .gte('scheduled_out_utc', windowStart + 'T00:00:00Z')
      .lte('scheduled_out_utc', windowEnd + 'T23:59:59Z'),
  ])

  const grid = buildCalendarGrid(year, month, sequences ?? [], flights ?? [])

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{label}</h1>
          <p className="text-sm text-foreground/50 mt-0.5">Schedule calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prevMonth}`}
            className="px-3 py-1.5 text-sm rounded-md text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            ← Prev
          </Link>
          <Link
            href={`/calendar?month=${nowYM}`}
            className="px-3 py-1.5 text-sm rounded-md text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${nextMonth}`}
            className="px-3 py-1.5 text-sm rounded-md text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            Next →
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={cn('px-2 py-0.5 rounded-full capitalize', cls)}>
            {status}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/30 border border-border">
          Day off
        </span>
      </div>

      {/* Calendar grid */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-xs text-foreground/40 uppercase tracking-wider text-center font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
          {grid.map(day => {
            const isToday = day.date === todayStr
            return (
              <div
                key={day.date}
                className={cn(
                  'min-h-[90px] p-1.5 flex flex-col gap-1',
                  !day.isCurrentMonth && 'opacity-30',
                  isToday && 'bg-green-primary/5',
                )}
              >
                {/* Day number */}
                <span className={cn(
                  'text-xs font-mono self-end px-1',
                  isToday
                    ? 'text-green-primary font-bold'
                    : day.isCurrentMonth
                    ? 'text-foreground/60'
                    : 'text-foreground/30',
                )}>
                  {parseInt(day.date.slice(8), 10)}
                </span>

                {/* Sequence pills */}
                {day.sequences.map(seq => (
                  <Link
                    key={seq.id}
                    href={`/sequences/${seq.id}`}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium truncate leading-tight',
                      STATUS_COLORS[seq.status] ?? 'bg-foreground/10 text-foreground/50',
                    )}
                    title={`Sequence ${seq.number} — ${seq.status}`}
                  >
                    {seq.number}
                  </Link>
                ))}

                {/* Flight count */}
                {day.flightCount > 0 && day.sequences.length === 0 && (
                  <span className="text-[10px] text-foreground/40 font-mono px-1">
                    {day.flightCount} flt{day.flightCount > 1 ? 's' : ''}
                  </span>
                )}

                {/* Day off indicator */}
                {day.isDayOff && day.isCurrentMonth && (
                  <span className="text-[10px] text-foreground/20 font-mono px-1 mt-auto">OFF</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
