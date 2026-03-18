import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { blockHours, flightHours } from '@/lib/utils/format'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: existing } = await supabase
    .from('flights')
    .select('pilot_id')
    .eq('id', id)
    .single()

  if (!existing || existing.pilot_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()

  const blockSched = body.scheduledOutUtc && body.scheduledInUtc
    ? blockHours(body.scheduledOutUtc, body.scheduledInUtc)
    : null
  const blockActual = body.actualOutUtc && body.actualInUtc
    ? blockHours(body.actualOutUtc, body.actualInUtc)
    : null
  const flightTime = body.actualOffUtc && body.actualOnUtc
    ? flightHours(body.actualOffUtc, body.actualOnUtc)
    : null

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
    .update({
      // Cast to any: generated types lag behind the 0004_fr24_fields migration
      ...({} as any),
      copilot_id:          copilotId,
      flight_number:       body.flightNumber,
      origin_icao:         body.originIcao?.toUpperCase(),
      destination_icao:    body.destinationIcao?.toUpperCase(),
      scheduled_out_utc:   body.scheduledOutUtc,
      scheduled_in_utc:    body.scheduledInUtc,
      actual_out_utc:      body.actualOutUtc || null,
      actual_off_utc:      body.actualOffUtc || null,
      actual_on_utc:       body.actualOnUtc || null,
      actual_in_utc:       body.actualInUtc || null,
      block_scheduled_hrs: blockSched,
      block_actual_hrs:    blockActual,
      flight_time_hrs:     flightTime,
      pilot_flying:        body.pilotFlying || null,
      pilot_monitoring:    body.pilotFlying === 'CA' ? 'FO' : body.pilotFlying === 'FO' ? 'CA' : null,
      landing_pilot:       body.landingPilot || null,
      aircraft_type:       body.aircraftType || null,
      tail_number:         body.tailNumber || null,
      approach_type:       body.approachType || null,
      approach_runway:     body.approachRunway || null,
      departure_gate:       body.departureGate      ?? null,
      arrival_gate:         body.arrivalGate         ?? null,
      departure_runway:     body.departureRunway     ?? null,
      cruise_gspeed_kts:    body.cruiseGspeedKts     ?? null,
      cruise_alt_ft:        body.cruiseAltFt          ?? null,
      descent_start_utc:    body.descentStartUtc     ?? null,
      airspace_transitions: body.airspaceTransitions ?? null,
      fr24_flight_id:       body.fr24FlightId        ?? null,
      metar_raw:           body.metarRaw || null,
      ceiling_ft:          body.ceilingFt ?? null,
      visibility_sm:       body.visibilitySm ?? null,
      is_deadhead:         body.isDeadhead ?? false,
      had_diversion:       body.hadDiversion ?? false,
      had_go_around:       body.hadGoAround ?? false,
      had_return_to_gate:  body.hadReturnToGate ?? false,
      notes:               body.notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flight: data })
}
