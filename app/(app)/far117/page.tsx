import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buildFAR117Status, LIMIT_28D, LIMIT_365D, MIN_REST_HOURS } from '@/lib/aviation/far117'
import { decimalToHHMM } from '@/lib/utils/format'

async function getFAR117Data(pilotId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: rollingData } = await supabase.rpc('compute_far117', {
    p_pilot_id: pilotId,
    p_as_of: new Date().toISOString(),
  })

  const { data: lastDuty } = await supabase
    .from('duty_periods')
    .select('duty_end_utc, duty_start_utc')
    .eq('pilot_id', pilotId)
    .not('duty_end_utc', 'is', null)
    .order('duty_end_utc', { ascending: false })
    .limit(5)

  return { rollingData, lastDuty }
}

function GaugeRing({ pct, label, current, limit, unit = 'hrs' }: {
  pct: number
  label: string
  current: number
  limit: number
  unit?: string
}) {
  const r = 64
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct / 100, 1)
  const color = pct >= 95 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#4ade80'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#243524" strokeWidth="12" />
        <circle
          cx="80" cy="80" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
        <text x="80" y="74" textAnchor="middle" fill={color} fontSize="20" fontWeight="bold" fontFamily="monospace">
          {current.toFixed(1)}
        </text>
        <text x="80" y="92" textAnchor="middle" fill="#d4e8d4" fontSize="11" opacity="0.5">
          / {limit} {unit}
        </text>
        <text x="80" y="110" textAnchor="middle" fill={color} fontSize="13" opacity="0.8">
          {pct.toFixed(0)}%
        </text>
      </svg>
      <p className="text-xs text-foreground/50 uppercase tracking-wider text-center">{label}</p>
    </div>
  )
}

export default async function FAR117Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { rollingData, lastDuty } = await getFAR117Data(user.id, supabase)
  const row = rollingData?.[0] || { flight_time_28d_hrs: 0, flight_time_365d_hrs: 0, duty_time_7d_hrs: 0 }

  const lastDutyEnd = lastDuty?.[0]?.duty_end_utc ? new Date(lastDuty[0].duty_end_utc) : null

  const status = buildFAR117Status({
    flightTime28dHrs: Number(row.flight_time_28d_hrs),
    flightTime365dHrs: Number(row.flight_time_365d_hrs),
    dutyTime7dHrs: Number(row.duty_time_7d_hrs),
    lastDutyEndUtc: lastDutyEnd,
  })

  const remainingRest = lastDutyEnd
    ? Math.max(0, MIN_REST_HOURS - (Date.now() - lastDutyEnd.getTime()) / 3600000)
    : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">FAR 117 Compliance</h1>
        <p className="text-sm text-foreground/50 mt-1">Rest & duty time tracking per 14 CFR Part 117</p>
      </div>

      {/* Compliance status */}
      {!status.isCompliant && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-400 mb-2">Regulatory Violations</p>
          {status.violations.map((v, i) => (
            <p key={i} className="text-xs text-red-300">{v}</p>
          ))}
        </div>
      )}

      {status.warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-400 mb-2">Approaching Limits</p>
          {status.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-300">{w}</p>
          ))}
        </div>
      )}

      {status.isCompliant && status.warnings.length === 0 && (
        <div className="bg-green-primary/10 border border-green-primary/20 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-primary shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-green-primary">All FAR 117 limits within bounds</p>
        </div>
      )}

      {/* Gauges */}
      <Card>
        <CardHeader><CardTitle>Flight Time Accumulators</CardTitle></CardHeader>
        <div className="flex justify-around py-4">
          <GaugeRing
            pct={status.flightTime28dPct}
            label="28-Day (100 hr limit)"
            current={status.flightTime28dHrs}
            limit={LIMIT_28D}
          />
          <GaugeRing
            pct={status.flightTime365dPct}
            label="365-Day (1,000 hr limit)"
            current={status.flightTime365dHrs}
            limit={LIMIT_365D}
          />
          <GaugeRing
            pct={(status.dutyTime7dHrs / 60) * 100}
            label="7-Day Duty Time"
            current={status.dutyTime7dHrs}
            limit={60}
          />
        </div>
      </Card>

      {/* Rest status */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle className="mb-4">Current Rest Status</CardTitle>
          {lastDutyEnd ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/50">Last release</span>
                <span className="font-mono">{lastDutyEnd.toISOString().slice(0, 16)}Z</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/50">Min rest required</span>
                <span className="font-mono">{MIN_REST_HOURS}:00</span>
              </div>
              {status.nextDutyEarliestStart && (
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/50">Earliest next duty</span>
                  <span className="font-mono text-green-primary">
                    {status.nextDutyEarliestStart.toISOString().slice(0, 16)}Z
                  </span>
                </div>
              )}
              {remainingRest > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/50">Rest remaining</span>
                    <Badge variant="yellow">{decimalToHHMM(remainingRest)} left</Badge>
                  </div>
                </div>
              )}
              {remainingRest <= 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Badge variant="green">Rest requirement satisfied</Badge>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground/40">No duty periods recorded yet</p>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-4">Regulatory Reference</CardTitle>
          <div className="space-y-2 text-xs text-foreground/50">
            <p><span className="text-foreground/80 font-medium">§117.11</span> — Flight time: 100 hrs/28 days, 1,000 hrs/365 days</p>
            <p><span className="text-foreground/80 font-medium">§117.13</span> — Max flight time per duty period: 8–9 hrs (varies by segments & WOCL)</p>
            <p><span className="text-foreground/80 font-medium">§117.25</span> — Min rest: 10 consecutive hours before any FDP</p>
            <p><span className="text-foreground/80 font-medium">§117.29</span> — Fatigue risk management program</p>
            <p className="mt-3 text-foreground/30 italic">This tool is for reference only. Always consult your airline&apos;s operations manual and FARs for official compliance.</p>
          </div>
        </Card>
      </div>

      {/* Recent duty periods */}
      {lastDuty && lastDuty.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Duty Periods</CardTitle></CardHeader>
          <div className="space-y-2">
            {lastDuty.map((dp, i) => {
              const start = new Date(dp.duty_start_utc)
              const end = dp.duty_end_utc ? new Date(dp.duty_end_utc) : null
              const dutyHrs = end ? (end.getTime() - start.getTime()) / 3600000 : null
              return (
                <div key={i} className="flex items-center gap-4 text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="font-mono text-xs text-foreground/50 w-36">{start.toISOString().slice(0, 16)}Z</span>
                  <span className="text-foreground/30">→</span>
                  <span className="font-mono text-xs text-foreground/50 w-36">
                    {end ? end.toISOString().slice(0, 16) + 'Z' : <span className="text-yellow-400">Active</span>}
                  </span>
                  {dutyHrs && (
                    <Badge variant={dutyHrs > 10 ? 'yellow' : 'green'}>
                      {decimalToHHMM(dutyHrs)}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
