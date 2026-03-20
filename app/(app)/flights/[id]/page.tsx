import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { decimalToHHMM, formatDate } from '@/lib/utils/format'
import { TimeDisplay } from '@/components/ui/time-display'
import { FlightMap } from '@/components/flights/flight-map'
import { FlightProfile } from '@/components/flights/flight-profile'
import { getAirportTimezone } from '@/lib/data/airport-timezones'
import { utcDtToLocal, getTimezoneAbbr } from '@/lib/utils/timezone'
import { deriveFlightStats, type TrackPoint } from '@/lib/api/flightaware'

/** Convert IATA-or-ICAO code to 4-letter ICAO for timezone lookup */
function toIcao(code: string | null): string {
  if (!code) return ''
  return code.length === 3 ? `K${code}` : code
}

/** Format a UTC ISO timestamp as HH:MM in a given IANA timezone.
 *  Returns { time: "HH:MM", abbr: "CDT" } or null. */
function localTime(utcIso: string | null, tz: string | null): { time: string; abbr: string } | null {
  if (!utcIso || !tz) return null
  const local = utcDtToLocal(utcIso.slice(0, 16), tz)
  if (!local) return null
  return { time: local.slice(11, 16), abbr: getTimezoneAbbr(tz) }
}

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

  const f = flight as any

  // ── Track & stats ────────────────────────────────────────────────────────
  const trackPoints: TrackPoint[] = (f.fa_track as TrackPoint[] | null) ?? []
  const hasTrack = trackPoints.length >= 2
  const stats = trackPoints.length >= 5 ? deriveFlightStats(trackPoints) : null

  const hasProfileData = !!(f.actual_off_utc || f.actual_on_utc)

  // Effective cruise values: prefer stored (may have been overridden by AA), fallback to derived
  const cruiseAltFt     = f.cruise_alt_ft     ?? stats?.cruiseAltFt     ?? null
  const cruiseGspeedKts = f.cruise_gspeed_kts ?? stats?.cruiseGspeedKts ?? null
  const descentStartUtc = f.descent_start_utc ?? stats?.descentStartUtc ?? null

  // ── Timezones ────────────────────────────────────────────────────────────
  const originTz = getAirportTimezone(toIcao(flight.origin_icao))
  const destTz   = getAirportTimezone(toIcao(flight.destination_icao))

  const outLocal  = localTime(flight.actual_out_utc,  originTz)
  const offLocal  = localTime(flight.actual_off_utc,  originTz)
  const onLocal   = localTime(flight.actual_on_utc,   destTz)
  const inLocal   = localTime(flight.actual_in_utc,   destTz)
  const sOutLocal = localTime(flight.scheduled_out_utc, originTz)
  const sInLocal  = localTime(flight.scheduled_in_utc,  destTz)

  // ── Layout helpers ───────────────────────────────────────────────────────
  const timeBlock = (
    label: string,
    utcIso: string | null,
    local: { time: string; abbr: string } | null,
    isActual = false,
  ) => (
    <div key={label}>
      <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{label}</p>
      <TimeDisplay iso={utcIso} isActual={isActual} />
      {local && (
        <p className="text-xs font-mono text-foreground/50 mt-0.5">
          {local.time} <span className="text-foreground/30">{local.abbr}</span>
        </p>
      )}
    </div>
  )

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
            {sOutLocal && (
              <p className="text-xs font-mono text-foreground/30 mt-1">{sOutLocal.time} <span className="text-foreground/20">{sOutLocal.abbr}</span></p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg className="w-10 h-4 text-green-primary" fill="none" viewBox="0 0 40 16">
              <path d="M2 8h32M28 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {flight.aircraft_type && <Badge variant="outline">{flight.aircraft_type}</Badge>}
            {flight.tail_number && <span className="text-xs font-mono text-foreground/40">{flight.tail_number}</span>}
            {stats?.distanceNm ? (
              <span className="text-xs font-mono text-foreground/30">{stats.distanceNm} nm</span>
            ) : null}
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
            {sInLocal && (
              <p className="text-xs font-mono text-foreground/30 mt-1">{sInLocal.time} <span className="text-foreground/20">{sInLocal.abbr}</span></p>
            )}
          </div>
        </div>
      </Card>

      {/* Flight stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Distance', value: stats.distanceNm ? `${stats.distanceNm} nm` : '—' },
            { label: 'Max Altitude', value: stats.maxAltFt ? `FL${Math.round(stats.maxAltFt / 100)}` : '—' },
            { label: 'Avg Cruise Spd', value: stats.avgCruiseGspeedKts ? `${stats.avgCruiseGspeedKts} kt` : '—' },
            {
              label: 'Climb / Desc',
              value: (stats.climbRateFpm || stats.descentRateFpm)
                ? `${stats.climbRateFpm ? `+${stats.climbRateFpm}` : '—'} / ${stats.descentRateFpm ? `-${stats.descentRateFpm}` : '—'} fpm`
                : '—'
            },
          ].map(s => (
            <Card key={s.label} className="py-3 px-4">
              <p className="text-xs text-foreground/40 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm font-mono font-semibold text-green-primary mt-1">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Map */}
      {hasTrack && (
        <FlightMap
          trackPoints={trackPoints}
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
              descentStartUtc={descentStartUtc}
              cruiseAltFt={cruiseAltFt}
              cruiseGspeedKts={cruiseGspeedKts}
              departureRunway={f.departure_runway}
              landingRunway={f.approach_runway}
              trackPoints={trackPoints}
            />
          </div>
        </Card>
      )}

      {/* Times */}
      <Card>
        <CardHeader>
          <CardTitle>Times</CardTitle>
          <span className="text-xs text-foreground/30 font-mono ml-auto">Zulu / Local</span>
        </CardHeader>
        <div className="grid grid-cols-4 gap-6 mb-4">
          {timeBlock('Sched OUT', flight.scheduled_out_utc, sOutLocal)}
          {timeBlock('Sched IN',  flight.scheduled_in_utc,  sInLocal)}
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Block (Sched)</p>
            <p className="text-lg font-mono font-bold text-foreground/50">
              {flight.block_scheduled_hrs ? decimalToHHMM(flight.block_scheduled_hrs) : '—'}
            </p>
          </div>
          <div />
        </div>
        <div className="grid grid-cols-4 gap-6 pt-4 border-t border-border">
          {timeBlock('OUT', flight.actual_out_utc, outLocal, true)}
          {timeBlock('OFF', flight.actual_off_utc, offLocal, true)}
          {timeBlock('ON',  flight.actual_on_utc,  onLocal,  true)}
          {timeBlock('IN',  flight.actual_in_utc,  inLocal,  true)}
        </div>
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-border mt-4">
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Block (Actual)</p>
            <p className="text-lg font-mono font-bold text-green-primary">
              {flight.block_actual_hrs ? decimalToHHMM(flight.block_actual_hrs) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Flight Time</p>
            <p className="text-lg font-mono font-bold text-green-primary">
              {flight.flight_time_hrs ? decimalToHHMM(flight.flight_time_hrs) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">Night</p>
            <p className="text-lg font-mono font-bold text-foreground/60">
              {f.night_time_hrs ? decimalToHHMM(f.night_time_hrs) : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Flight Data (cruise) */}
      {(cruiseAltFt || cruiseGspeedKts || descentStartUtc) && (
        <Card>
          <CardHeader><CardTitle>Flight Data</CardTitle></CardHeader>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {cruiseAltFt && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Cruise Alt</p>
                <p className="font-mono font-semibold text-foreground">
                  FL{Math.round(cruiseAltFt / 100)}
                  <span className="text-foreground/40 text-xs ml-1">({cruiseAltFt.toLocaleString()}ft)</span>
                </p>
              </div>
            )}
            {cruiseGspeedKts && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Cruise Speed</p>
                <p className="font-mono font-semibold text-foreground">{cruiseGspeedKts} kt</p>
              </div>
            )}
            {descentStartUtc && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Top of Descent</p>
                <p className="font-mono font-semibold text-foreground">
                  {new Date(descentStartUtc).toISOString().slice(11, 16)}Z
                  {destTz && (() => {
                    const loc = localTime(descentStartUtc, destTz)
                    return loc ? <span className="text-foreground/40 text-xs ml-1">({loc.time} {loc.abbr})</span> : null
                  })()}
                </p>
              </div>
            )}
            {stats?.climbRateFpm && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Avg Climb Rate</p>
                <p className="font-mono font-semibold text-foreground">+{stats.climbRateFpm} fpm</p>
              </div>
            )}
            {stats?.descentRateFpm && (
              <div>
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">Avg Descent Rate</p>
                <p className="font-mono font-semibold text-foreground">−{stats.descentRateFpm} fpm</p>
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
