/**
 * FlightAware AeroAPI client
 * Fetches actual OUT/OFF/ON/IN times (ACARS gate times)
 * API docs: https://flightaware.com/aeroapi/portal/documentation
 */

const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi'

export interface ACARSTimes {
  outUtc: string | null    // Gate departure (brakes released)
  offUtc: string | null    // Wheels off
  onUtc: string | null     // Wheels on
  inUtc: string | null     // Gate arrival (chocks in)
  tailNumber: string | null
  aircraftType: string | null
  origin: string | null
  destination: string | null
}

async function faFetch(path: string): Promise<Response> {
  const apiKey = process.env.FLIGHTAWARE_AEROAPI_KEY
  if (!apiKey) throw new Error('FLIGHTAWARE_AEROAPI_KEY not configured')

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-apikey': apiKey,
      'Accept': 'application/json; charset=UTF-8',
    },
    next: { revalidate: 3600 },  // cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`)
  }

  return response
}

/**
 * Fetch ACARS times for a specific flight
 * @param flightId  e.g. "MQ4512" or "MQ4512-1234567890-airline-0123"
 * @param date      "YYYY-MM-DD" (used to filter if multiple results)
 */
export async function fetchACARSTimes(
  flightIdent: string,
  date: string,
): Promise<ACARSTimes | null> {
  try {
    // FlightAware ident format: carrier+number (IATA or ICAO)
    // Try to get flights for this ident on the given date
    const startTime = `${date}T00:00:00Z`
    const endTime = `${date}T23:59:59Z`

    const res = await faFetch(
      `/flights/${encodeURIComponent(flightIdent)}?start=${startTime}&end=${endTime}&max_pages=1`
    )
    const data = await res.json()

    // Find the best matching flight
    const flights: FlightAwareFlightResult[] = data.flights || []
    if (flights.length === 0) return null

    // Pick the most recent / completed result
    const flight = flights.find(f => f.actual_on_block_time) || flights[0]

    return {
      outUtc: flight.actual_off_block_time || null,
      offUtc: flight.actual_runway_off || null,
      onUtc: flight.actual_runway_on || null,
      inUtc: flight.actual_on_block_time || null,
      tailNumber: flight.registration || null,
      aircraftType: mapAircraftType(flight.aircraft_type || ''),
      origin: flight.origin?.code_iata || null,
      destination: flight.destination?.code_iata || null,
    }
  } catch (err) {
    console.error('FlightAware fetch error:', err)
    return null
  }
}

interface FlightAwareFlightResult {
  fa_flight_id: string
  actual_off_block_time: string | null
  actual_runway_off: string | null
  actual_runway_on: string | null
  actual_on_block_time: string | null
  registration: string | null
  aircraft_type: string | null
  origin?: { code_iata: string }
  destination?: { code_iata: string }
}

function mapAircraftType(faType: string): string | null {
  if (faType.includes('E170') || faType === 'E70') return 'E170'
  if (faType.includes('E175') || faType === 'E75') return 'E175'
  return faType || null
}
