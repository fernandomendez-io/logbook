import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePayPeriod } from '@/lib/pay/calculator'
import type { Flight } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { data: flights, error } = await supabase
    .from('flights')
    .select('*')
    .eq('pilot_id', user.id)
    .gte('scheduled_out_utc', `${yearStart}T00:00:00Z`)
    .lte('scheduled_out_utc', `${yearEnd}T23:59:59Z`)
    .order('scheduled_out_utc', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allFlights = (flights ?? []) as Flight[]
  const today = new Date()

  // Build per-month summaries for months that have flights or are in the past
  const monthlySummaries = []
  for (let m = 1; m <= 12; m++) {
    const monthStart = `${year}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
    const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Only include months up to the current month
    if (new Date(monthStart) > today) break

    const monthFlights = allFlights.filter(f => {
      const d = f.scheduled_out_utc.slice(0, 10)
      return d >= monthStart && d <= monthEnd
    })

    const summary = calculatePayPeriod(monthFlights, monthStart, monthEnd)
    monthlySummaries.push({
      month: monthStart.slice(0, 7), // YYYY-MM
      summary,
    })
  }

  // YTD totals
  const ytdFlights = allFlights.filter(f => f.scheduled_out_utc.slice(0, 10) <= today.toISOString().slice(0, 10))
  const ytdSummary = calculatePayPeriod(ytdFlights as Flight[], yearStart, today.toISOString().slice(0, 10))

  return NextResponse.json({ months: monthlySummaries, ytd: ytdSummary, year })
}
