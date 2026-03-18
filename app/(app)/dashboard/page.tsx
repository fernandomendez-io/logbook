import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { decimalToHHMM, formatDate } from '@/lib/utils/format'
import { buildFAR117Status, LIMIT_28D, LIMIT_365D } from '@/lib/aviation/far117'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const now = new Date()
  const nowIso = now.toISOString()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const monthEndIso = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}T23:59:59Z`

  // ── Past flights this month (for stats) ──
  const { data: pastMonthFlights } = await supabase
    .from('flights')
    .select('block_scheduled_hrs, block_actual_hrs, flight_time_hrs, is_cancelled, is_deadhead')
    .eq('pilot_id', user.id)
    .gte('scheduled_out_utc', `${monthStart}T00:00:00Z`)
    .lte('scheduled_out_utc', nowIso)

  // ── Upcoming flights this month ──
  const { data: upcomingMonthFlights } = await supabase
    .from('flights')
    .select('*')
    .eq('pilot_id', user.id)
    .eq('is_cancelled', false)
    .gt('scheduled_out_utc', nowIso)
    .lte('scheduled_out_utc', monthEndIso)
    .order('scheduled_out_utc', { ascending: true })

  // ── Recent past flights for the list ──
  const { data: recentFlights } = await supabase
    .from('flights')
    .select('*')
    .eq('pilot_id', user.id)
    .lte('scheduled_out_utc', nowIso)
    .order('scheduled_out_utc', { ascending: false })
    .limit(5)

  // ── FAR 117 current ──
  const { data: far117Data } = await supabase.rpc('compute_far117', {
    p_pilot_id: user.id,
    p_as_of: nowIso,
  })
  const { data: lastDuty } = await supabase
    .from('duty_periods')
    .select('duty_end_utc')
    .eq('pilot_id', user.id)
    .not('duty_end_utc', 'is', null)
    .order('duty_end_utc', { ascending: false })
    .limit(1)
    .single()

  const row = far117Data?.[0] || { flight_time_28d_hrs: 0, flight_time_365d_hrs: 0, duty_time_7d_hrs: 0 }
  const far117 = buildFAR117Status({
    flightTime28dHrs: Number(row.flight_time_28d_hrs),
    flightTime365dHrs: Number(row.flight_time_365d_hrs),
    dutyTime7dHrs: Number(row.duty_time_7d_hrs),
    lastDutyEndUtc: lastDuty?.duty_end_utc ? new Date(lastDuty.duty_end_utc) : null,
  })

  // ── Month stats ──
  const monthBlock = pastMonthFlights?.reduce((s, f) =>
    s + Math.max(f.block_scheduled_hrs || 0, f.block_actual_hrs || 0), 0) || 0
  const monthFlight = pastMonthFlights?.reduce((s, f) => s + (f.flight_time_hrs || 0), 0) || 0
  const monthCount = pastMonthFlights?.filter(f => !f.is_cancelled && !f.is_deadhead).length || 0

  // ── Upcoming month projections ──
  const upcomingBlockHrs = upcomingMonthFlights?.reduce((s, f) => s + (f.block_scheduled_hrs || 0), 0) || 0
  const upcomingCount = upcomingMonthFlights?.length || 0

  // Project 28-day: current actual + upcoming scheduled block (only those within rolling 28d window)
  const windowStart28d = new Date(now.getTime() - 28 * 24 * 3600000).toISOString()
  const upcomingIn28d = upcomingMonthFlights?.filter(f => f.scheduled_out_utc > windowStart28d) || []
  const upcomingIn28dHrs = upcomingIn28d.reduce((s, f) => s + (f.block_scheduled_hrs || 0), 0)
  const projected28d = Number(row.flight_time_28d_hrs) + upcomingIn28dHrs
  const projected28dPct = (projected28d / LIMIT_28D) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Welcome back, {profile?.first_name}
          </h1>
          <p className="text-sm text-foreground/50 mt-1">
            {profile?.seat} · {profile?.base} · #{profile?.employee_number}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/sequences/new">
            <Button size="sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Import Sequence
            </Button>
          </Link>
          <Link href="/flights/new">
            <Button variant="secondary" size="sm">Log Flight</Button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {!far117.isCompliant && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">FAR 117 Violation</p>
            {far117.violations.map((v, i) => <p key={i} className="text-xs text-red-300">{v}</p>)}
          </div>
          <Link href="/far117" className="ml-auto text-xs text-red-400 hover:underline">View Details →</Link>
        </div>
      )}

      {/* Projected 28-day warning */}
      {far117.isCompliant && projected28dPct >= 85 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-yellow-300">
            Projected 28-day flight time: <span className="font-mono font-medium">{projected28d.toFixed(1)} / {LIMIT_28D} hrs</span>
            {projected28d > LIMIT_28D
              ? ' — scheduled flights would exceed the 28-day limit'
              : ` — ${(LIMIT_28D - projected28d).toFixed(1)} hrs remaining after scheduled`}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'This Month — Flights', value: monthCount.toString() },
          { label: 'This Month — Block', value: decimalToHHMM(monthBlock) },
          { label: 'This Month — Flight Time', value: decimalToHHMM(monthFlight) },
          { label: '28-Day Flight Time', value: `${row.flight_time_28d_hrs.toFixed(1)} / ${LIMIT_28D} hrs` },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-green-primary font-mono">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: Recent + Upcoming */}
        <div className="col-span-2 space-y-4">

          {/* Upcoming this month */}
          {upcomingCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rest of Month</CardTitle>
                <span className="text-xs text-foreground/40">{upcomingCount} leg{upcomingCount !== 1 ? 's' : ''} · {decimalToHHMM(upcomingBlockHrs)} scheduled</span>
              </CardHeader>
              <div className="space-y-0.5">
                {upcomingMonthFlights!.map(f => (
                  <Link key={f.id} href={`/flights/${f.id}`}>
                    <div className="flex items-center gap-4 py-2 px-2 rounded-md hover:bg-surface-raised transition-colors text-sm">
                      <span className="font-mono text-xs text-foreground/40 w-24 shrink-0">{formatDate(f.scheduled_out_utc)}</span>
                      <span className="font-mono font-medium text-green-primary w-20 shrink-0">{f.flight_number}</span>
                      <span className="font-mono text-foreground/60">{f.origin_icao}–{f.destination_icao}</span>
                      <span className="ml-auto font-mono text-xs text-foreground/50">
                        {new Date(f.scheduled_out_utc).toISOString().slice(11, 16)}Z
                      </span>
                      <span className="font-mono text-xs text-foreground/40 w-12 text-right">
                        {f.block_scheduled_hrs ? decimalToHHMM(f.block_scheduled_hrs) : '—'}
                      </span>
                      {f.is_deadhead && <Badge variant="blue">DHD</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
              {/* Projected 28-day bar */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-xs text-foreground/50 mb-1.5">
                  <span>Projected 28-day after schedule</span>
                  <span className="font-mono">{projected28d.toFixed(1)} / {LIMIT_28D} hrs</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  {/* Actual so far */}
                  <div className="h-full rounded-full flex">
                    <div
                      className="h-full transition-all duration-700"
                      style={{
                        width: `${Math.min((Number(row.flight_time_28d_hrs) / LIMIT_28D) * 100, 100)}%`,
                        background: '#4ade80',
                      }}
                    />
                    <div
                      className="h-full transition-all duration-700"
                      style={{
                        width: `${Math.min((upcomingIn28dHrs / LIMIT_28D) * 100, 100 - (Number(row.flight_time_28d_hrs) / LIMIT_28D) * 100)}%`,
                        background: projected28dPct >= 100 ? '#ef4444' : projected28dPct >= 85 ? '#f59e0b' : '#86efac',
                        opacity: 0.5,
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-foreground/30 mt-1">
                  <span>Flown: {Number(row.flight_time_28d_hrs).toFixed(1)} hrs</span>
                  <span>Scheduled: +{upcomingIn28dHrs.toFixed(1)} hrs</span>
                </div>
              </div>
            </Card>
          )}

          {/* Recent flights */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Flights</CardTitle>
              <Link href="/flights" className="text-xs text-green-primary hover:underline">View all →</Link>
            </CardHeader>
            <div className="space-y-1">
              {recentFlights?.length ? recentFlights.map(f => (
                <Link key={f.id} href={`/flights/${f.id}`}>
                  <div className="flex items-center gap-4 py-2.5 px-2 rounded-md hover:bg-surface-raised transition-colors text-sm">
                    <span className="font-mono text-xs text-foreground/40 w-24">{formatDate(f.scheduled_out_utc)}</span>
                    <span className="font-mono font-medium text-green-primary w-20">{f.flight_number}</span>
                    <span className="font-mono text-foreground/60">{f.origin_icao}–{f.destination_icao}</span>
                    <span className="ml-auto font-mono text-xs text-foreground/50">
                      {f.block_actual_hrs ? decimalToHHMM(f.block_actual_hrs) :
                       f.block_scheduled_hrs ? decimalToHHMM(f.block_scheduled_hrs) : '—'}
                    </span>
                    {f.approach_type && <Badge variant={f.approach_type === 'visual' ? 'green' : 'yellow'}>{f.approach_type}</Badge>}
                  </div>
                </Link>
              )) : (
                <div className="text-center py-10 text-foreground/40 text-sm">
                  No flights yet.{' '}
                  <Link href="/sequences/new" className="text-green-primary hover:underline">Import a sequence</Link>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: FAR 117 + Quick actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FAR 117 Status</CardTitle>
              <Link href="/far117" className="text-xs text-green-primary hover:underline">Details →</Link>
            </CardHeader>
            <div className="space-y-3">
              {[
                {
                  label: '28-Day',
                  pct: far117.flightTime28dPct,
                  projectedPct: projected28dPct,
                  val: far117.flightTime28dHrs,
                  projected: projected28d,
                  limit: LIMIT_28D,
                  showProjection: upcomingIn28dHrs > 0,
                },
                {
                  label: '365-Day',
                  pct: far117.flightTime365dPct,
                  projectedPct: far117.flightTime365dPct,
                  val: far117.flightTime365dHrs,
                  projected: far117.flightTime365dHrs,
                  limit: LIMIT_365D,
                  showProjection: false,
                },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs text-foreground/50 mb-1">
                    <span>{item.label}</span>
                    <span className="font-mono">
                      {item.val.toFixed(1)}
                      {item.showProjection && <span className="text-foreground/30"> → {item.projected.toFixed(1)}</span>}
                      {' '}/ {item.limit}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(item.pct, 100)}%`,
                        background: item.pct >= 95 ? '#ef4444' : item.pct >= 85 ? '#f59e0b' : '#4ade80',
                      }}
                    />
                  </div>
                  {item.showProjection && item.projectedPct > item.pct && (
                    <div
                      className="h-2 rounded-full -mt-2 overflow-hidden opacity-30"
                      style={{ marginLeft: `${Math.min(item.pct, 100)}%`, width: `${Math.min(item.projectedPct - item.pct, 100 - item.pct)}%` }}
                    >
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <div className="space-y-2">
              <Link href="/sequences/new" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-green-primary transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Import Sequence
              </Link>
              <Link href="/flights/new" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-green-primary transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Log Flight Manually
              </Link>
              <Link href="/pay" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-green-primary transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Check Pay Period
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
