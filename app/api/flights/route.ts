import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { blockHours, flightHours } from '@/lib/utils/format'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const acType = searchParams.get('aircraft')
  const approach = searchParams.get('approach')

  let query = supabase
    .from('flights')
    .select('*, profiles!flights_copilot_id_fkey(first_name, last_name, employee_number)', { count: 'exact' })
    .eq('pilot_id', user.id)
    .order('scheduled_out_utc', { ascending: false })
    .range(offset, offset + limit - 1)

  if (start) query = query.gte('scheduled_out_utc', `${start}T00:00:00Z`)
  if (end) query = query.lte('scheduled_out_utc', `${end}T23:59:59Z`)
  if (acType) query = query.eq('aircraft_type', acType as 'E170' | 'E175')
  if (approach) query = query.eq('approach_type', approach as 'visual' | 'ILS' | 'RNAV' | 'RNP' | 'VOR' | 'NDB' | 'LOC' | 'other')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flights: data, total: count })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Compute derived fields
  const blockSched = body.scheduledOutUtc && body.scheduledInUtc
    ? blockHours(body.scheduledOutUtc, body.scheduledInUtc)
    : null
  const blockActual = body.actualOutUtc && body.actualInUtc
    ? blockHours(body.actualOutUtc, body.actualInUtc)
    : null
  const flightTime = body.actualOffUtc && body.actualOnUtc
    ? flightHours(body.actualOffUtc, body.actualOnUtc)
    : null

  // Look up copilot by employee number if provided
  let copilotId: string | null = null
  if (body.copilotEmployeeNumber) {
    const { data: pilot } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_number', body.copilotEmployeeNumber)
      .single()
    copilotId = pilot?.id || null
  }

  const { data, error } = await supabase
    .from('flights')
    .insert({
      pilot_id: user.id,
      copilot_id: copilotId,
      sequence_id: body.sequenceId || null,
      duty_period_id: body.dutyPeriodId || null,
      flight_number: body.flightNumber,
      origin_icao: body.originIcao?.toUpperCase(),
      destination_icao: body.destinationIcao?.toUpperCase(),
      scheduled_out_utc: body.scheduledOutUtc,
      scheduled_in_utc: body.scheduledInUtc,
      actual_out_utc: body.actualOutUtc || null,
      actual_off_utc: body.actualOffUtc || null,
      actual_on_utc: body.actualOnUtc || null,
      actual_in_utc: body.actualInUtc || null,
      block_scheduled_hrs: blockSched,
      block_actual_hrs: blockActual,
      flight_time_hrs: flightTime,
      pilot_flying: body.pilotFlying || null,
      pilot_monitoring: body.pilotFlying === 'CA' ? 'FO' : body.pilotFlying === 'FO' ? 'CA' : null,
      landing_pilot: body.landingPilot || null,
      aircraft_type: body.aircraftType || null,
      tail_number: body.tailNumber || null,
      approach_type: body.approachType || null,
      approach_runway: body.approachRunway || null,
      metar_raw: body.metarRaw || null,
      ceiling_ft: body.ceilingFt || null,
      visibility_sm: body.visibilitySm || null,
      weather_conditions: body.weatherConditions || null,
      is_deadhead: body.isDeadhead || false,
      is_cancelled: body.isCancelled || false,
      had_diversion: body.hadDiversion || false,
      had_go_around: body.hadGoAround || false,
      had_return_to_gate: body.hadReturnToGate || false,
      rtg_reason: body.rtgReason || null,
      notes: body.notes || null,
      cross_country: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flight: data }, { status: 201 })
}
