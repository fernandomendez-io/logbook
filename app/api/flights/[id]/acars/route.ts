/**
 * POST /api/flights/:id/acars
 * Fetches FlightAware data for a flight and saves it directly.
 * Uses FlightAware data only. Scheduled times are stored as nominal local — origin_timezone
 * is used to derive the correct UTC date for the FA lookup window.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFlightAwareFlight, deriveFlightStats, type TrackPoint } from '@/lib/api/flightaware'
import { prefixFlightForSearch } from '@/lib/data/carriers'
import { blockHours, flightHours } from '@/lib/utils/format'
import { calculateNightTimeHrs } from '@/lib/utils/night-time'
import { localDtToUtc } from '@/lib/utils/timezone'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: flight } = await supabase
    .from('flights')
    .select('pilot_id, flight_number, scheduled_out_utc, scheduled_in_utc, origin_icao, actual_out_utc, actual_off_utc, actual_on_utc, actual_in_utc, origin_timezone')
    .eq('id', id)
    .single()

  if (!flight) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('operating_carrier, role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  if (flight.pilot_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // scheduled_out_utc stores nominal local time — convert to UTC using origin timezone
  // so the FA query window covers the correct calendar day
  const originTz     = (flight as any).origin_timezone as string | null
  const nominalLocal = flight.scheduled_out_utc.slice(0, 16)  // "YYYY-MM-DDTHH:MM" local
  const utcDt        = originTz ? localDtToUtc(nominalLocal, originTz) : null
  const date         = (utcDt ?? nominalLocal).slice(0, 10)   // correct UTC date for FA

  const origin = flight.origin_icao?.length === 4
    ? flight.origin_icao.slice(1)   // KDFW → DFW
    : flight.origin_icao
  const searchFlight = prefixFlightForSearch(flight.flight_number, profile?.operating_carrier)

  // Check cache
  const { data: cachedRaw } = await supabase
    .from('acars_cache')
    .select('*')
    .eq('flight_number', flight.flight_number)
    .eq('flight_date', date)
    .eq('origin_icao', origin ?? '')
    .single()

  const cached = cachedRaw as any

  let t: Record<string, any>
  let faFlightId: string | null = null
  let fromCache = false
  let track: TrackPoint[] = []

  if (cached) {
    fromCache = true
    faFlightId = cached.fa_flight_id ?? null
    track = (cached.fa_track as TrackPoint[]) ?? []
    t = {
      outUtc:              cached.out_utc,
      offUtc:              cached.off_utc,
      onUtc:               cached.on_utc,
      inUtc:               cached.in_utc,
      tailNumber:          cached.tail_number,
      aircraftType:        cached.aircraft_type,
      departureGate:       cached.departure_gate,
      arrivalGate:         cached.arrival_gate,
      departureRunway:     cached.departure_runway,
      landingRunway:       cached.landing_runway,
      cruiseGspeedKts:     cached.cruise_gspeed_kts,
      cruiseAltFt:         cached.cruise_alt_ft,
      descentStartUtc:     cached.descent_start_utc,
      originTimezone:      cached.origin_timezone,
      destTimezone:        cached.dest_timezone,
      route:               cached.route,
      routeDistanceNm:     cached.route_distance_nm,
      filedAirspeedKts:    cached.filed_airspeed_kts,
      filedAltitudeFt:     cached.filed_altitude_ft,
      terminalOrigin:      cached.terminal_origin,
      terminalDestination: cached.terminal_destination,
      baggageClaim:        cached.baggage_claim,
      departureDelaySec:   cached.departure_delay_sec,
      arrivalDelaySec:     cached.arrival_delay_sec,
    }
  } else {
    const result = await fetchFlightAwareFlight(searchFlight, date, origin ?? undefined)

    if (!result.times) {
      return NextResponse.json({ error: 'No tracking data found', debug: result.raw }, { status: 404 })
    }

    faFlightId = result.faFlightId
    track = result.track
    t = { ...result.times }

    // Derive stats from track if we have it
    const stats = track.length >= 5 ? deriveFlightStats(track) : null
    if (stats) {
      t.cruiseAltFt     = t.cruiseAltFt     ?? stats.cruiseAltFt
      t.cruiseGspeedKts = t.cruiseGspeedKts ?? stats.cruiseGspeedKts
      t.descentStartUtc = t.descentStartUtc ?? stats.descentStartUtc
    }

    // Side effect: cache airport data for origin/dest using the timezone FA returned
    // Use ignoreDuplicates so we never downgrade a full airport record with partial data
    const originIcaoFa = t.originIcao as string | null
    const destIcaoFa   = t.destIcao   as string | null
    const originTzFa   = t.originTimezone as string | null
    const destTzFa     = t.destTimezone   as string | null
    const airportDb = supabase as any
    if (originIcaoFa && originTzFa) {
      await airportDb.from('airports').upsert(
        { airport_code: originIcaoFa, code_icao: originIcaoFa, timezone: originTzFa, fetched_at: new Date().toISOString() },
        { onConflict: 'airport_code', ignoreDuplicates: true },
      )
    }
    if (destIcaoFa && destTzFa) {
      await airportDb.from('airports').upsert(
        { airport_code: destIcaoFa, code_icao: destIcaoFa, timezone: destTzFa, fetched_at: new Date().toISOString() },
        { onConflict: 'airport_code', ignoreDuplicates: true },
      )
    }

    await supabase.from('acars_cache').upsert({
      flight_number:        flight.flight_number,
      flight_date:          date,
      origin_icao:          origin ?? '',
      out_utc:              t.outUtc,
      off_utc:              t.offUtc,
      on_utc:               t.onUtc,
      in_utc:               t.inUtc,
      tail_number:          t.tailNumber,
      aircraft_type:        t.aircraftType,
      origin_iata:          t.origin,
      dest_iata:            t.destination,
      departure_gate:       t.departureGate    ?? null,
      arrival_gate:         t.arrivalGate      ?? null,
      departure_runway:     t.departureRunway  ?? null,
      landing_runway:       t.landingRunway    ?? null,
      cruise_gspeed_kts:    t.cruiseGspeedKts  ?? null,
      cruise_alt_ft:        t.cruiseAltFt      ?? null,
      descent_start_utc:    t.descentStartUtc  ?? null,
      fa_flight_id:         faFlightId,
      fa_track:             track.length > 0 ? track : null,
      raw_response:         result.raw as any,
      origin_timezone:      t.originTimezone      ?? null,
      dest_timezone:        t.destTimezone        ?? null,
      origin_icao_fa:       t.originIcao          ?? null,
      dest_icao_fa:         t.destIcao            ?? null,
      route:                t.route               ?? null,
      route_distance_nm:    t.routeDistanceNm     ?? null,
      filed_airspeed_kts:   t.filedAirspeedKts    ?? null,
      filed_altitude_ft:    t.filedAltitudeFt     ?? null,
      terminal_origin:      t.terminalOrigin      ?? null,
      terminal_destination: t.terminalDestination ?? null,
      baggage_claim:        t.baggageClaim        ?? null,
      departure_delay_sec:  t.departureDelaySec   ?? null,
      arrival_delay_sec:    t.arrivalDelaySec     ?? null,
    }, { onConflict: 'flight_number,flight_date,origin_icao' })
  }

  // Preserve any times the pilot already entered — only fill nulls
  const outUtc  = flight.actual_out_utc  || t.outUtc  || null
  const offUtc  = flight.actual_off_utc  || t.offUtc  || null
  const onUtc   = flight.actual_on_utc   || t.onUtc   || null
  const inUtc   = flight.actual_in_utc   || t.inUtc   || null

  const blockActual = outUtc && inUtc ? blockHours(outUtc, inUtc) : null
  const flightTime  = offUtc && onUtc ? flightHours(offUtc, onUtc) : null

  // Night time from track points
  const nightTimeHrs = track.length >= 2 ? calculateNightTimeHrs(track) : null

  // Derive stats for flight record update (use cached stats or re-derive from track)
  const stats = track.length >= 5 ? deriveFlightStats(track) : null

  const { data: updated, error } = await supabase
    .from('flights')
    .update({
      actual_out_utc:    outUtc,
      actual_off_utc:    offUtc,
      actual_on_utc:     onUtc,
      actual_in_utc:     inUtc,
      block_actual_hrs:  blockActual   || null,
      flight_time_hrs:   flightTime    || null,
      tail_number:       t.tailNumber  || null,
      aircraft_type:     t.aircraftType || null,
      departure_gate:    t.departureGate    ?? null,
      arrival_gate:      t.arrivalGate      ?? null,
      departure_runway:  t.departureRunway  ?? null,
      approach_runway:   t.landingRunway    ?? null,
      cruise_gspeed_kts: t.cruiseGspeedKts  ?? null,
      cruise_alt_ft:     t.cruiseAltFt      ?? null,
      descent_start_utc: t.descentStartUtc  ?? null,
      fa_flight_id:         faFlightId,
      fa_track:             track.length > 0 ? track : undefined,
      fa_fetched_at:        new Date().toISOString(),
      night_time_hrs:       nightTimeHrs,
      origin_timezone:      t.originTimezone      ?? null,
      dest_timezone:        t.destTimezone        ?? null,
      route:                t.route               ?? null,
      route_distance_nm:    t.routeDistanceNm     ?? null,
      filed_airspeed_kts:   t.filedAirspeedKts    ?? null,
      filed_altitude_ft:    t.filedAltitudeFt     ?? null,
      terminal_origin:      t.terminalOrigin      ?? null,
      terminal_destination: t.terminalDestination ?? null,
      baggage_claim:        t.baggageClaim        ?? null,
    } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flight: updated, source: fromCache ? 'cache' : 'live', stats })
}
