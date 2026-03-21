import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseSequence } from '@/lib/parsers/sequence-parser'

/**
 * Format a local HHMM time as a nominal ISO timestamp for storage.
 * If the arrival HHMM is numerically less than the departure HHMM, arrival
 * crossed midnight and belongs to the next calendar day.
 * These are NOT real UTC times — just nominal scheduled values from the crew sheet.
 * Real UTC conversion happens when FA data is fetched.
 */
function nominalTime(date: string, hhmm: string, depHhmm?: string): string {
  let d = date
  if (depHhmm && parseInt(hhmm) < parseInt(depHhmm)) {
    const next = new Date(date + 'T00:00:00Z')
    next.setUTCDate(next.getUTCDate() + 1)
    d = next.toISOString().slice(0, 10)
  }
  return `${d}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00`
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
    const flightRows = flights.map((f: any) => ({
      sequence_id:         seq.id,
      pilot_id:            user.id,
      flight_number:       f.flightNumber,
      origin_icao:         f.originIcao,
      destination_icao:    f.destinationIcao,
      scheduled_out_utc:   nominalTime(f.date, f.scheduledOut),
      scheduled_in_utc:    nominalTime(f.date, f.scheduledIn, f.scheduledOut),
      block_scheduled_hrs: f.scheduledBlockHrs ?? null,  // from FLY column, already decimal hours
      aircraft_type:       f.aircraftType || null,
      tail_number:         f.tailNumber   || null,
      is_deadhead:         f.isDeadhead,
      is_cancelled:        f.isCancelled,
      cross_country:       true,
    }))

    const { error: flightErr } = await supabase.from('flights').insert(flightRows)
    if (flightErr) console.error('Flight insert error:', flightErr)
  }

  return NextResponse.json({ sequence: seq, flightCount: flights.length })
}
