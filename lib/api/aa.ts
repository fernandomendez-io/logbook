/**
 * American Airlines flightinfo API client.
 * Provides authoritative ACARS gate departure/arrival times for AA-marketed flights,
 * including all American Eagle subsidiary (MQ, OH, ZW, PT) operations.
 */

export interface AAGateTimes {
  outUtc: string | null  // gate departure (actual_out_utc)
  inUtc:  string | null  // gate arrival  (actual_in_utc)
  origin: string | null  // IATA origin code
  dest:   string | null  // IATA destination code
}

/**
 * Strip a 2-letter carrier prefix from a flight number.
 * "MQ3434" → "3434", "AA3434" → "3434", "3434" → "3434"
 */
export function stripCarrierPrefix(flightNumber: string): string {
  return flightNumber.replace(/^[A-Z]{2}/i, '').replace(/^0+/, '') || flightNumber
}

function toUtcIso(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 19) + 'Z'
  } catch {
    return null
  }
}

function pickTime(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key]
    if (val && typeof val === 'string') return toUtcIso(val)
    // Handle nested { dateTime: "..." } pattern
    if (val && typeof val === 'object') {
      const nested = (val as Record<string, unknown>).dateTime
      if (nested && typeof nested === 'string') return toUtcIso(nested)
    }
  }
  return null
}

function pickIata(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key]
    if (val && typeof val === 'string') return val
    if (val && typeof val === 'object') {
      const code = (val as Record<string, unknown>).code
      if (code && typeof code === 'string') return code
    }
  }
  return null
}

export async function fetchAAGateTimes(
  flightNumber: string,  // numeric only, no carrier prefix
  date: string,          // "YYYY-MM-DD"
): Promise<AAGateTimes | null> {
  try {
    const res = await fetch('https://www.aa.com/flightinfo/v1.2/', {
      method: 'POST',
      headers: {
        'accept':         'application/json, text/plain, */*',
        'client-details': 'aa-ct-aacom/flifoui',
        'content-type':   'application/json',
        'locale':         'en',
        'origin':         'https://www.aa.com',
      },
      body: JSON.stringify([{
        airlineCode:     'AA',
        destAirportCode: '',
        flightNumber:    flightNumber,
        fltOrgDate:      date,
        orgAirportCode:  '',
      }]),
    })

    if (!res.ok) return null

    const json = await res.json()
    if (!Array.isArray(json) || json.length === 0) return null

    const flight = json[0] as Record<string, unknown>

    // Gate departure time — try multiple known field names from AA API versions
    const outUtc = pickTime(
      flight,
      'actualDepartureDateTime',
      'actualDeparture',
      'estimatedDepartureDateTime',
      'estimatedDeparture',
    )

    // Gate arrival time
    const inUtc = pickTime(
      flight,
      'actualArrivalDateTime',
      'actualArrival',
      'estimatedArrivalDateTime',
      'estimatedArrival',
    )

    // Try leg-level times if top-level times not found
    let legOutUtc = outUtc
    let legInUtc  = inUtc
    let origin: string | null = null
    let dest:   string | null = null

    const legs = flight.legs ?? flight.legFlights
    if (Array.isArray(legs) && legs.length > 0) {
      const leg = legs[0] as Record<string, unknown>
      if (!legOutUtc) {
        legOutUtc = pickTime(leg,
          'actualDepartureDateTime', 'actualDeparture',
          'estimatedDepartureDateTime', 'estimatedDeparture',
        )
      }
      if (!legInUtc) {
        legInUtc = pickTime(leg,
          'actualArrivalDateTime', 'actualArrival',
          'estimatedArrivalDateTime', 'estimatedArrival',
        )
      }
      origin = pickIata(leg, 'origin', 'originAirportCode', 'departureAirport')
      dest   = pickIata(leg, 'destination', 'destinationAirportCode', 'arrivalAirport')
    }

    // Top-level origin/dest as fallback
    if (!origin) origin = pickIata(flight, 'origin', 'originAirportCode', 'departureAirport')
    if (!dest)   dest   = pickIata(flight, 'destination', 'destinationAirportCode', 'arrivalAirport')

    // Return null if we got nothing useful
    if (!legOutUtc && !legInUtc) return null

    return { outUtc: legOutUtc, inUtc: legInUtc, origin, dest }
  } catch {
    return null
  }
}
