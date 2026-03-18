import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { decimalToHHMM, formatDate } from '@/lib/utils/format'
import { TimeDisplay } from '@/components/ui/time-display'
import { FlightMap } from '@/components/flights/flight-map'
import { FlightProfile } from '@/components/flights/flight-profile'

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: flight } = await supabase
    .from('flights')
    .select('*')
    .eq('id', id)
    .single()

  if (!flight || (flight.pilot_id !== user.id && flight.copilot_id !== user.id)) notFound()

  // Look up copilot name
  let copilotName = null
  if (flight.copilot_id) {
    const { data: cp } = await supabase
      .from('profiles')
      .select('first_name, last_name, employee_number, seat')
      .eq('id', flight.copilot_id)
      .single()
    copilotName = cp
  }

  // Parse FR24 raw data stored in JSONB
  const fr24Raw = (flight as any).fr24_raw as Record<string, any> | null
  const rawEvents: any[] = fr24Raw?.events?.data?.[0]?.events ?? []

  // Cast new columns (added in migrations 0004 + 0005)
  const f = flight as any

  const timeRow = (label: string, value: string | null, isActual = false) => (
    <div key={label}>
      <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">{label}</p>
      <TimeDisplay iso={value} isActual={isActual} />
    </div>
  )

  const hasFr24Data = !!(f.cruise_alt_ft || f.cruise_gspeed_kts || f.descent_start_utc ||
    (f.airspace_transitions && f.airspace_transitions.length > 0))
  const hasProfileData = !!(f.actual_off_utc || f.actual_on_utc)

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/flights" className="text-foreground/40 hover:text-foreground">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-green-primary font-mono">{flight.flight_number}</h1>
          <p className="text-sm text-foreground/50">{formatDate(flight.scheduled_out_utc)}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap justify-end">
          {flight.is_deadhead && <Badge variant="blue">Deadhead</Badge>}
          {flight.is_cancelled && <Badge variant="red">Cancelled</Badge>}
          {flight.had_diversion && <Badge variant="red">Diversion</Badge>}
          {flight.had_go_around && <Badge variant="yellow">Go-Around</Badge>}
          {flight.had_return_to_gate && <Badge variant="yellow">RTG</Badge>}
          <Link href={`/flights/${id}/edit`}>
            <Badge variant="outline" className="cursor-pointer hover:border-green-dim">Edit</Badge>
          </Link>
        </div>
      </div>

      {/* Route */}
      <Card>
        <div className="flex items-center justify-center gap-8 py-4">
          <div className="text-center">
            <p className="text-4xl font-bold font-mono text-foreground">{flight.origin_icao}</p>
            {f.departure_gate && (
              <p className="text-xs font-mono text-foreground/40 mt-1">Gate {f.departure_gate}</p>
            )}
            {f.departure_runway && (
              <p className="text-xs font-mono text-green-primary/60 mt-0.5">Rwy {f.departure_runway}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg className="w-10 h-4 text-green-primary" fill="none" viewBox="0 0 40 16">
              <path d="M2 8h32M28 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {flight.aircraft_type && <Badge variant="outline">{flight.aircraft_type}</Badge>}
            {flight.tail_number && <span className="text-xs font-mono text-foreground/40">{flight.tail_number}</span>}
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold font-mono text-foreground">{flight.destination_icao}</p>
            {f.arrival_gate && (
              <p className="text-xs font-mono text-foreground/40 mt-1">Gate {f.arrival_gate}</p>
            )}
            {f.approach_runway && (
              <p className="text-xs font-mono text-green-primary/60 mt-0.5">Rwy {f.approach_runway}</p>
            )}
            {flight.diverted_to_icao && (
              <p className="text-sm text-red-400 font-mono">→ {flight.diverted_to_icao}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Map */}
      {rawEvents.length >= 2 && (
        <FlightMap
          rawEvents={rawEvents}
          originIcao={flight.origin_icao ?? ''}
          destIcao={flight.destination_icao ?? ''}
        />
      )}

      {/* Flight profile */}
      {hasProfileData && (
        <Card className="overflow-visible">
          <CardHeader><CardTitle>Flight Profile</CardTitle></CardHeader>
          <div className="relative mt-2 pb-2">
            <FlightProfile
              outUtc={f.actual_out_utc}
              offUtc={f.actual_off_utc}
              onUtc={f.actual_on_utc}
              inUtc={f.actual_in_utc}
              descentStartUtc={f.descent_start_utc}
              cruiseAltFt={f.cruise_alt_ft}
              cruiseGspeedKts={f.cruise_gspeed_kts}
              airspaceTransitions={f.airspace_transitions ?? []}
              departureRunway={f.departure_runway}
              landingRunway={f.approach_runway}
              rawEvents={rawEvents}
            />
          </div>
        </Card>
      )}

      {/* Times */}
      <Card>
        <CardHeader><CardTitle>Times (UTC)</CardTitle></CardHeader>
        <div className="grid grid-cols-4 gap-6 mb-4">
          {timeRow('Sched OUT', flight.scheduled_out_utc)}
          {timeRow('Sched IN', flight.scheduled_in_utc)}
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Block (Sched)</p>
            <p className="text-lg font-mono font-bold text-foreground/50">
              {flight.block_scheduled_hrs ? decimalToHHMM(flight.block_scheduled_hrs) : '—'}
            </p>
          </div>
          <div />
        </div>
        <div className="grid grid-cols-4 gap-6 pt-4 border-t border-border">
          {timeRow('OUT', flight.actual_out_utc, true)}
          {timeRow('OFF', flight.actual_off_utc, true)}
          {timeRow('ON',  flight.actual_on_utc,  true)}
          {timeRow('IN',  flight.actual_in_utc,  true)}
        </div>
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-border mt-4">
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Block (Actual)</p>
            <p className="text-lg font-mono font-bold text-green-primary">
              {flight.block_actual_hrs ? decimalToHHMM(flight.block_actual_hrs) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Flight Time</p>
            <p className="text-lg font-mono font-bold text-green-primary">
              {flight.flight_time_hrs ? decimalToHHMM(flight.flight_time_hrs) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Night</p>
            <p className="text-lg font-mono font-bold text-foreground/60">
              {f.night_time_hrs ? decimalToHHMM(f.night_time_hrs) : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* FR24 Flight Data */}
      {hasFr24Data && (
        <Card>
          <CardHeader><CardTitle>Flight Data</CardTitle></CardHeader>
          <div className="space-y-4 text-sm">
            {/* Cruise */}
            {(f.cruise_alt_ft || f.cruise_gspeed_kts || f.descent_start_utc) && (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {f.cruise_alt_ft && (
                  <div>
                    <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Cruise Alt</p>
                    <p className="font-mono font-semibold text-foreground">
                      FL{Math.round(f.cruise_alt_ft / 100)}
                      <span className="text-foreground/40 text-xs ml-1">({f.cruise_alt_ft.toLocaleString()}ft)</span>
                    </p>
                  </div>
                )}
                {f.cruise_gspeed_kts && (
                  <div>
                    <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Ground Speed</p>
                    <p className="font-mono font-semibold text-foreground">{f.cruise_gspeed_kts} kt</p>
                  </div>
                )}
                {f.descent_start_utc && (
                  <div>
                    <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Top of Descent</p>
                    <p className="font-mono font-semibold text-foreground">
                      {new Date(f.descent_start_utc).toISOString().slice(11, 16)}Z
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Airspace transitions */}
            {f.airspace_transitions && f.airspace_transitions.length > 0 && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-2">Airspace</p>
                <div className="flex flex-wrap gap-2">
                  {(f.airspace_transitions as any[]).map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 bg-surface-raised rounded-md px-2.5 py-1.5 border border-border/50">
                      {t.exited && (
                        <span className="text-xs font-mono text-foreground/40">{t.exited}</span>
                      )}
                      {t.exited && t.entered && (
                        <span className="text-green-primary/50 text-xs">→</span>
                      )}
                      {t.entered && (
                        <span className="text-xs font-mono text-foreground">{t.entered}</span>
                      )}
                      <span className="text-xs text-foreground/30 ml-1">
                        {new Date(t.timestamp).toISOString().slice(11, 16)}Z
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Crew & Approach */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Crew</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground/50">Pilot Flying</span>
              <span className="font-mono">{flight.pilot_flying || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/50">Landing Pilot</span>
              <span className="font-mono">{flight.landing_pilot || '—'}</span>
            </div>
            {copilotName && (
              <div className="flex justify-between">
                <span className="text-foreground/50">Co-pilot</span>
                <span className="font-medium">
                  {copilotName.first_name} {copilotName.last_name}{' '}
                  <span className="text-foreground/40 font-normal">(#{copilotName.employee_number})</span>
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>Approach</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground/50">Type</span>
              {flight.approach_type
                ? <Badge variant={flight.approach_type === 'visual' ? 'green' : 'yellow'}>{flight.approach_type}</Badge>
                : <span className="text-foreground/30">—</span>}
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/50">Landing Runway</span>
              <span className="font-mono">{flight.approach_runway || '—'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* METAR */}
      {flight.metar_raw && (
        <Card>
          <CardHeader><CardTitle>Weather at Landing</CardTitle></CardHeader>
          <code className="text-xs font-mono text-foreground/60 block">{flight.metar_raw}</code>
          <div className="flex gap-4 mt-3 text-sm">
            {flight.ceiling_ft !== null && (
              <span className="text-foreground/50">Ceiling: <span className="text-foreground">{flight.ceiling_ft}ft</span></span>
            )}
            {flight.visibility_sm !== null && (
              <span className="text-foreground/50">Vis: <span className="text-foreground">{flight.visibility_sm}sm</span></span>
            )}
          </div>
        </Card>
      )}

      {/* Notes */}
      {flight.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <p className="text-sm text-foreground/70">{flight.notes}</p>
        </Card>
      )}
    </div>
  )
}
