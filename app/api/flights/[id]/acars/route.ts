/**
 * POST /api/flights/:id/acars
 * Fetches FR24 data for a flight and saves it directly.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchACARSTimes } from '@/lib/api/fr24'
import { prefixFlightForSearch } from '@/lib/data/carriers'
import { blockHours, flightHours } from '@/lib/utils/format'
import { extractFlightPoints, calculateNightTimeHrs } from '@/lib/utils/night-time'

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

  const { data: cachedRaw } = await supabase
    .from('acars_cache')
    .select('*')
    .eq('flight_number', flight.flight_number)
    .eq('flight_date', date)
    .eq('origin_icao', origin ?? '')
    .single()

  // Cast to any: generated types lag behind the 0004_fr24_fields migration
  const cached = cachedRaw as any

  let t: Record<string, any>
  let fr24FlightId: string | null = null
  let fromCache = false
  let rawResponse: unknown = null

  if (cached) {
    fromCache = true
    fr24FlightId = cached.fr24_flight_id
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
      airspaceTransitions: cached.airspace_transitions,
    }
  } else {
    const result = await fetchACARSTimes(searchFlight, date, origin ?? undefined)
    if (!result.times) {
      return NextResponse.json({ error: 'No tracking data found', debug: result.raw }, { status: 404 })
    }
    fr24FlightId = result.fr24FlightId
    rawResponse = result.raw
    t = result.times as any

    await supabase.from('acars_cache').upsert({
      flight_number:        flight.flight_number,
      flight_date:          date,
      origin_icao:          origin ?? '',
      out_utc:              result.times.outUtc,
      off_utc:              result.times.offUtc,
      on_utc:               result.times.onUtc,
      in_utc:               result.times.inUtc,
      tail_number:          result.times.tailNumber,
      aircraft_type:        result.times.aircraftType,
      origin_iata:          result.times.origin,
      dest_iata:            result.times.destination,
      departure_gate:       result.times.departureGate  ?? null,
      arrival_gate:         result.times.arrivalGate    ?? null,
      departure_runway:     result.times.departureRunway ?? null,
      landing_runway:       result.times.landingRunway   ?? null,
      cruise_gspeed_kts:    result.times.cruiseGspeedKts ?? null,
      cruise_alt_ft:        result.times.cruiseAltFt     ?? null,
      descent_start_utc:    result.times.descentStartUtc ?? null,
      airspace_transitions: result.times.airspaceTransitions ?? [],
      fr24_flight_id:       result.fr24FlightId,
      raw_response:         result.raw as any,
    }, { onConflict: 'flight_number,flight_date,origin_icao' })
  }

  const blockActual = t.outUtc && t.inUtc ? blockHours(t.outUtc, t.inUtc) : null
  const flightTime  = t.offUtc && t.onUtc ? flightHours(t.offUtc, t.onUtc) : null

  // Night time: only calculable from live fetch (needs lat/lon from raw events)
  const flightPoints = fromCache ? [] : extractFlightPoints(rawResponse)
  const nightTimeHrs = flightPoints.length >= 2 ? calculateNightTimeHrs(flightPoints) : null

  const { data: updated, error } = await supabase
    .from('flights')
    .update({
      actual_out_utc:       t.outUtc        || null,
      actual_off_utc:       t.offUtc        || null,
      actual_on_utc:        t.onUtc         || null,
      actual_in_utc:        t.inUtc         || null,
      block_actual_hrs:     blockActual     || null,
      flight_time_hrs:      flightTime      || null,
      tail_number:          t.tailNumber    || null,
      aircraft_type:        t.aircraftType  || null,
      departure_gate:       t.departureGate    ?? null,
      arrival_gate:         t.arrivalGate      ?? null,
      departure_runway:     t.departureRunway  ?? null,
      approach_runway:      t.landingRunway    ?? null,
      cruise_gspeed_kts:    t.cruiseGspeedKts  ?? null,
      cruise_alt_ft:        t.cruiseAltFt      ?? null,
      descent_start_utc:    t.descentStartUtc  ?? null,
      airspace_transitions: t.airspaceTransitions ?? null,
      fr24_flight_id:       fr24FlightId,
      fr24_raw:             fromCache ? undefined : (rawResponse as any),
      night_time_hrs:       nightTimeHrs,
    } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flight: updated, source: fromCache ? 'cache' : 'live' })
}
