import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import FlightForm from '@/components/flights/flight-form'
import type { FlightFormInitialValues } from '@/components/flights/flight-form'

function toLocalDT(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16).replace(' ', 'T')
}

export default async function EditFlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: flight } = await supabase
    .from('flights')
    .select('*')
    .eq('id', id)
    .single()

  if (!flight || flight.pilot_id !== user.id) notFound()

  // Resolve copilot employee number if needed
  let copilotEmployeeNumber: string | undefined
  if (flight.copilot_id) {
    const { data: cp } = await supabase
      .from('profiles')
      .select('employee_number')
      .eq('id', flight.copilot_id)
      .single()
    copilotEmployeeNumber = cp?.employee_number ?? undefined
  }

  const initialValues: FlightFormInitialValues = {
    flightNumber:      flight.flight_number ?? '',
    originIcao:        flight.origin_icao ?? '',
    destinationIcao:   flight.destination_icao ?? '',
    scheduledOutUtc:   toLocalDT(flight.scheduled_out_utc),
    scheduledInUtc:    toLocalDT(flight.scheduled_in_utc),
    actualOutUtc:      toLocalDT(flight.actual_out_utc),
    actualOffUtc:      toLocalDT(flight.actual_off_utc),
    actualOnUtc:       toLocalDT(flight.actual_on_utc),
    actualInUtc:       toLocalDT(flight.actual_in_utc),
    aircraftType:      flight.aircraft_type ?? '',
    tailNumber:        flight.tail_number ?? '',
    pilotFlying:       flight.pilot_flying ?? '',
    landingPilot:      flight.landing_pilot ?? '',
    approachType:      flight.approach_type ?? '',
    approachRunway:    flight.approach_runway ?? '',
    copilotEmployeeNumber,
    isDeadhead:        flight.is_deadhead ?? false,
    hadDiversion:      flight.had_diversion ?? false,
    hadGoAround:       flight.had_go_around ?? false,
    hadRTG:            flight.had_return_to_gate ?? false,
    notes:             flight.notes ?? '',
  }

  return <FlightForm flightId={id} initialValues={initialValues} />
}
