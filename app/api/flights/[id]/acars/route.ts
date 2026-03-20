/**
 * POST /api/flights/:id/acars
 * Fetches FlightAware data for a flight and saves it directly.
 * AA gate times still take priority for OUT/IN (most authoritative for AA-marketed flights).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFlightAwareFlight, deriveFlightStats, type TrackPoint } from '@/lib/api/flightaware'
import { fetchAAGateTimes, stripCarrierPrefix } from '@/lib/api/aa'
import { prefixFlightForSearch } from '@/lib/data/carriers'
import { blockHours, flightHours } from '@/lib/utils/format'
import { calculateNightTimeHrs } from '@/lib/utils/night-time'

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
    .select('pilot_id, flight_number, scheduled_out_utc, scheduled_in_utc, origin_icao')
    .eq('id', id)
    .single()

  if (!flight || flight.pilot_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('operating_carrier')
    .eq('id', user.id)
    .single()

  const date   = new Date(flight.scheduled_out_utc).toISOString().slice(0, 10)
  const origin = flight.origin_icao?.length === 4
    ? flight.origin_icao.slice(1)   // KDFW → DFW
    : flight.origin_icao
  const searchFlight = prefixFlightForSearch(flight.flight_number, profile?.operating_carrier)
  const numericFlight = stripCarrierPrefix(flight.flight_number)

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
      outUtc:          cached.out_utc,
      offUtc:          cached.off_utc,
      onUtc:           cached.on_utc,
      inUtc:           cached.in_utc,
      tailNumber:      cached.tail_number,
      aircraftType:    cached.aircraft_type,
      departureGate:   cached.departure_gate,
      arrivalGate:     cached.arrival_gate,
      departureRunway: cached.departure_runway,
      landingRunway:   cached.landing_runway,
      cruiseGspeedKts: cached.cruise_gspeed_kts,
      cruiseAltFt:     cached.cruise_alt_ft,
      descentStartUtc: cached.descent_start_utc,
    }
  } else {
    // Fetch FlightAware and AA in parallel — AA gate times take priority for OUT/IN
    const [result, aa] = await Promise.all([
      fetchFlightAwareFlight(searchFlight, date, origin ?? undefined),
      fetchAAGateTimes(numericFlight, date),
    ])

    if (!result.times && !aa) {
      return NextResponse.json({ error: 'No tracking data found', debug: result.raw }, { status: 404 })
    }

    faFlightId = result.faFlightId
    track = result.track
    t = {
      ...(result.times ?? {}),
      outUtc: aa?.outUtc ?? result.times?.outUtc ?? null,
      inUtc:  aa?.inUtc  ?? result.times?.inUtc  ?? null,
    }

    // Derive stats from track if we have it
    const stats = track.length >= 5 ? deriveFlightStats(track) : null
    if (stats) {
      t.cruiseAltFt     = t.cruiseAltFt     ?? stats.cruiseAltFt
      t.cruiseGspeedKts = t.cruiseGspeedKts ?? stats.cruiseGspeedKts
      t.descentStartUtc = t.descentStartUtc ?? stats.descentStartUtc
    }

    await supabase.from('acars_cache').upsert({
      flight_number:    flight.flight_number,
      flight_date:      date,
      origin_icao:      origin ?? '',
      out_utc:          t.outUtc,
      off_utc:          t.offUtc,
      on_utc:           t.onUtc,
      in_utc:           t.inUtc,
      tail_number:      t.tailNumber,
      aircraft_type:    t.aircraftType,
      origin_iata:      t.origin,
      dest_iata:        t.destination,
      departure_gate:   t.departureGate    ?? null,
      arrival_gate:     t.arrivalGate      ?? null,
      departure_runway: t.departureRunway  ?? null,
      landing_runway:   t.landingRunway    ?? null,
      cruise_gspeed_kts: t.cruiseGspeedKts ?? null,
      cruise_alt_ft:    t.cruiseAltFt      ?? null,
      descent_start_utc: t.descentStartUtc ?? null,
      fa_flight_id:     faFlightId,
      fa_track:         track.length > 0 ? track : null,
      raw_response:     result.raw as any,
    }, { onConflict: 'flight_number,flight_date,origin_icao' })
  }

  // AA always overrides OUT/IN even on cached paths — gate data is authoritative
  if (fromCache) {
    const aa = await fetchAAGateTimes(numericFlight, date)
    if (aa?.outUtc) t.outUtc = aa.outUtc
    if (aa?.inUtc)  t.inUtc  = aa.inUtc
  }

  const blockActual = t.outUtc && t.inUtc ? blockHours(t.outUtc, t.inUtc) : null
  const flightTime  = t.offUtc && t.onUtc ? flightHours(t.offUtc, t.onUtc) : null

  // Night time from track points
  const nightTimeHrs = track.length >= 2 ? calculateNightTimeHrs(track) : null

  // Derive stats for flight record update (use cached stats or re-derive from track)
  const stats = track.length >= 5 ? deriveFlightStats(track) : null

  const { data: updated, error } = await supabase
    .from('flights')
    .update({
      actual_out_utc:    t.outUtc      || null,
      actual_off_utc:    t.offUtc      || null,
      actual_on_utc:     t.onUtc       || null,
      actual_in_utc:     t.inUtc       || null,
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
      fa_flight_id:      faFlightId,
      fa_track:          track.length > 0 ? track : undefined,
      night_time_hrs:    nightTimeHrs,
    } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flight: updated, source: fromCache ? 'cache' : 'live', stats })
}
