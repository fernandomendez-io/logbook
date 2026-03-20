import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseSequence } from '@/lib/parsers/sequence-parser'
import { blockHours } from '@/lib/utils/format'
import { getAirportTimezone } from '@/lib/data/airport-timezones'
import { localDtToUtc } from '@/lib/utils/timezone'

/**
 * Convert an airport-local HHMM time + date to a UTC ISO timestamp.
 * If the arrival HHMM is numerically less than the departure HHMM, the
 * arrival crossed midnight and belongs to the next calendar day.
 */
function localHHMMtoUtc(date: string, hhmm: string, tz: string, depHhmm?: string): string {
  let resolvedDate = date
  if (depHhmm && parseInt(hhmm) < parseInt(depHhmm)) {
    const d = new Date(date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    resolvedDate = d.toISOString().slice(0, 10)
  }
  const localDT = `${resolvedDate}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`
  const utc = localDtToUtc(localDT, tz)
  return utc ? utc + ':00Z' : localDT + ':00Z'
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sequences')
    .select('*, flights(id)')
    .eq('pilot_id', user.id)
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sequences: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rawText, yearMonth, confirmedFlights } = body

  if (!rawText) return NextResponse.json({ error: 'rawText required' }, { status: 400 })

  const parsed = parseSequence(rawText, yearMonth)

  // Insert sequence
  const { data: seq, error: seqErr } = await supabase
    .from('sequences')
    .insert({
      pilot_id: user.id,
      sequence_number: parsed.sequenceNumber,
      raw_text: rawText,
      report_date: parsed.reportDate,
      release_date: parsed.releaseDate,
      domicile: parsed.domicile,
      status: 'active',
    })
    .select()
    .single()

  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 })

  // Insert flights
  const flights = confirmedFlights || parsed.allFlights
  if (flights.length > 0) {
    // Sequence parser outputs 3-letter IATA codes (e.g. "ORD") but airport-timezones
    // uses 4-letter ICAO keys (e.g. "KORD"). Convert CONUS codes by prepending "K".
    // Alaska/Hawaii airports already have 4-letter codes in the timezone map (PANC, PHNL, etc.)
    // so they pass through unchanged.
    const toIcao = (code: string) => code.length === 3 ? `K${code}` : code

    const flightRows = flights.map((f: any) => {
      const originTz = getAirportTimezone(toIcao(f.originIcao)) ?? 'UTC'
      const destTz   = getAirportTimezone(toIcao(f.destinationIcao)) ?? 'UTC'
      const scheduledOut = localHHMMtoUtc(f.date, f.scheduledOut, originTz)
      const scheduledIn  = localHHMMtoUtc(f.date, f.scheduledIn,  destTz, f.scheduledOut)
      const scheduled = blockHours(scheduledOut, scheduledIn)

      return {
        sequence_id: seq.id,
        pilot_id: user.id,
        flight_number: f.flightNumber,
        origin_icao: f.originIcao,
        destination_icao: f.destinationIcao,
        scheduled_out_utc: scheduledOut,
        scheduled_in_utc: scheduledIn,
        block_scheduled_hrs: scheduled > 0 ? scheduled : null,
        aircraft_type: f.aircraftType || null,
        tail_number: f.tailNumber || null,
        is_deadhead: f.isDeadhead,
        is_cancelled: f.isCancelled,
        cross_country: true,
      }
    })

    const { error: flightErr } = await supabase.from('flights').insert(flightRows)
    if (flightErr) console.error('Flight insert error:', flightErr)
  }

  return NextResponse.json({ sequence: seq, flightCount: flights.length })
}
