import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { decimalToHHMM } from '@/lib/utils/format'
import { calculateLogbookTotals } from '@/lib/aviation/logbook'
import { cn } from '@/lib/utils/cn'

export default async function LogbookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nowIso = new Date().toISOString()

  const [{ data: flights }, { data: profile }] = await Promise.all([
    supabase
      .from('flights')
      .select('*')
      .eq('pilot_id', user.id)
      .lte('scheduled_out_utc', nowIso)
      .order('scheduled_out_utc', { ascending: false }),
    supabase
      .from('profiles')
      .select('seat, first_name, last_name, employee_number')
      .eq('id', user.id)
      .single(),
  ])

  const pilotSeat = profile?.seat ?? null
  const totals = calculateLogbookTotals(flights ?? [], pilotSeat)

  const approachOrder = ['ILS', 'RNAV', 'RNP', 'VOR', 'LOC', 'NDB', 'other']
  const sortedApproaches = approachOrder
    .filter(t => totals.approachesByType[t])
    .map(t => ({ type: t, count: totals.approachesByType[t] }))

  const pilotName = profile ? `${profile.first_name} ${profile.last_name}` : ''

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Logbook</h1>
          <p className="text-sm text-foreground/50 mt-1">
            Cumulative flight time totals · {totals.totalFlights} flights logged
          </p>
        </div>
        <a
          href="/api/logbook/export"
          download
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border text-foreground/60 hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </a>
      </div>

      {/* All-Time Time Totals */}
      <Card>
        <CardHeader><CardTitle>All-Time Totals</CardTitle></CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Total Block', value: decimalToHHMM(totals.totalBlockHrs) },
            { label: 'Flight Time', value: decimalToHHMM(totals.totalFlightHrs) },
            { label: 'Night Time', value: decimalToHHMM(totals.totalNightHrs) },
            { label: 'PIC (TPIC)', value: decimalToHHMM(totals.picBlockHrs) },
            { label: 'SIC / FO', value: decimalToHHMM(totals.sicBlockHrs) },
            { label: 'Deadhead', value: decimalToHHMM(totals.deadheadHrs) },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-green-primary font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Approaches */}
      <Card>
        <CardHeader><CardTitle>Instrument Approaches</CardTitle></CardHeader>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl font-bold text-green-primary font-mono">{totals.totalApproaches}</span>
          <span className="text-sm text-foreground/50">total instrument approaches</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedApproaches.map(({ type, count }) => (
            <div key={type} className="flex items-center gap-2 bg-surface-raised rounded-lg px-3 py-2">
              <Badge variant={type === 'ILS' ? 'blue' : 'yellow'}>{type}</Badge>
              <span className="font-mono text-sm font-semibold">{count}</span>
            </div>
          ))}
          {sortedApproaches.length === 0 && (
            <p className="text-sm text-foreground/40">No instrument approaches recorded</p>
          )}
        </div>
      </Card>

      {/* Aircraft Breakdown */}
      <Card>
        <CardHeader><CardTitle>By Aircraft Type</CardTitle></CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {Object.entries(totals.byAircraft).map(([type, hrs]) => (
            <div key={type}>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{type}</p>
              <p className="text-2xl font-bold text-green-primary font-mono">{decimalToHHMM(hrs)}</p>
            </div>
          ))}
          {Object.keys(totals.byAircraft).length === 0 && (
            <p className="text-sm text-foreground/40 col-span-4">No aircraft type data recorded</p>
          )}
        </div>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader><CardTitle>Currency & Recency</CardTitle></CardHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Last 90-Day Appr.', value: String(totals.last90DayApproaches), unit: 'appr.' },
              { label: 'Last 6-Mo Appr.', value: String(totals.last6MonthApproaches), unit: 'appr.' },
              { label: 'Last 28-Day Block', value: decimalToHHMM(totals.last28DayBlockHrs), unit: '' },
              { label: 'Last 365-Day Block', value: decimalToHHMM(totals.last365DayBlockHrs), unit: '' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-green-primary font-mono">
                  {s.value}
                  {s.unit && <span className="text-sm font-normal text-foreground/40 ml-1">{s.unit}</span>}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/30 pt-2">
            IFR currency: 6 approaches + holding in preceding 6 calendar months (61.57). Instrument approach totals exclude visual approaches.
          </p>
        </div>
      </Card>

      {/* 121.439 Landing Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Landing Currency — §121.439</CardTitle>
          {pilotSeat ? (
            <Badge variant={totals.landingCurrencyMet ? 'green' : 'red'} className="ml-auto">
              {totals.landingCurrencyMet ? 'Current' : 'Not Current'}
            </Badge>
          ) : (
            <span className="ml-auto text-xs text-foreground/40">Set your seat in Profile to track</span>
          )}
        </CardHeader>
        {pilotSeat ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Day Landings (90 days)</p>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    'text-3xl font-bold font-mono',
                    totals.landingsLast90Days >= 3 ? 'text-green-primary' : 'text-red-400'
                  )}>
                    {totals.landingsLast90Days}
                  </span>
                  <span className="text-foreground/40 text-sm">/ 3 required</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Night Landings (90 days)</p>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    'text-3xl font-bold font-mono',
                    totals.nightLandingsLast90Days >= 1 ? 'text-green-primary' : 'text-red-400'
                  )}>
                    {totals.nightLandingsLast90Days}
                  </span>
                  <span className="text-foreground/40 text-sm">/ 1 required (for night ops)</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-foreground/30">
              Counts flights where you were the landing pilot (seat: {pilotSeat}) in the preceding 90 days.
              Night landing = flight with any recorded night time. Verify against §121.439 and your airline&apos;s ops manual.
            </p>
          </div>
        ) : (
          <p className="text-sm text-foreground/40">
            Set your seat (CA/FO) in your{' '}
            <Link href="/profile" className="text-green-primary hover:underline">Profile</Link>{' '}
            to track landing currency.
          </p>
        )}
      </Card>

      {/* Summary counts */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-foreground/50">
        <div className="flex justify-between border-b border-border/30 pb-2">
          <span>Total legs flown</span>
          <span className="font-mono font-medium text-foreground">{totals.totalFlights}</span>
        </div>
        <div className="flex justify-between border-b border-border/30 pb-2">
          <span>Deadhead legs</span>
          <span className="font-mono font-medium text-foreground">{totals.deadheadCount}</span>
        </div>
        <div className="flex justify-between border-b border-border/30 pb-2">
          <span>Cancelled</span>
          <span className="font-mono font-medium text-foreground">{totals.cancelledCount}</span>
        </div>
      </div>
    </div>
  )
}
