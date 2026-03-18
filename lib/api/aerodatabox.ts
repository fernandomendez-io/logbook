/**
 * AeroDataBox flight data client (via RapidAPI)
 * Fetches actual OUT/OFF/ON/IN times for a flight
 * Sign up: https://rapidapi.com/aedbx-aedbx/api/aerodatabox
 * Free tier: 2,000 calls/month
 *
 * Time mapping:
 *   OUT = departure.actualTimeUtc  (gate departure / off-block)
 *   OFF = departure.runwayTimeUtc  (wheels off)
 *   ON  = arrival.runwayTimeUtc    (wheels on)
 *   IN  = arrival.actualTimeUtc    (gate arrival / on-block)
 */

const BASE_URL = 'https://aerodatabox.p.rapidapi.com'

export interface ACARSTimes {
  outUtc: string | null    // Gate departure (brakes released)
  offUtc: string | null    // Wheels off
  onUtc: string | null     // Wheels on
  inUtc: string | null     // Gate arrival (chocks in)
  tailNumber: string | null
  aircraftType: string | null
  origin: string | null
  destination: string | null
  /** True when AeroDataBox only returned air times (OFF/ON) — OUT/IN require manual entry */
  gateTimesUnavailable?: boolean
}

async function adbFetch(path: string): Promise<unknown> {
  const apiKey = process.env.AERODATABOX_API_KEY
  if (!apiKey) throw new Error('AERODATABOX_API_KEY not configured')

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
    },
    next: { revalidate: 3600 },
  })

  const text = await response.text()

  if (!response.ok) {
    console.error(`AeroDataBox ${response.status}: ${text.slice(0, 300)}`)
    throw new Error(`AeroDataBox API error: ${response.status} ${response.statusText}`)
  }

  if (!text || text.trim() === '' || text.trim() === 'null') return null

  try {
    return JSON.parse(text)
  } catch {
    console.error('AeroDataBox non-JSON response:', text.slice(0, 300))
    return null
  }
}

/**
 * Fetch ACARS times for a specific flight leg.
 * @param flightIdent  e.g. "MQ4512" (IATA carrier code + number)
 * @param date         "YYYY-MM-DD" local departure date
 * @param originIata   3-letter departure airport — required for turn flights
 *                     that reuse the same flight number on multiple legs
 */
export interface ACARSResult {
  times: ACARSTimes | null
  /** Scheduled times from AeroDataBox — used as a fallback hint only, never auto-filled */
  scheduledHint: ACARSTimes | null
  /** Raw AeroDataBox payload — included always so callers can log/debug */
  raw: unknown
  selectedIndex: number | null
  totalLegs: number
  /** Flight status string from AeroDataBox, e.g. "CanceledUncertain", "Landed" */
  status: string | null
}

export async function fetchACARSTimes(
  flightIdent: string,
  date: string,
  originIata?: string,
): Promise<ACARSResult> {
  try {
    const raw = await adbFetch(
      `/flights/number/${encodeURIComponent(flightIdent)}/${date}` +
      `?withAircraftImage=false&withLocation=false`
    )

    console.log('[AeroDataBox] raw response:', JSON.stringify(raw)?.slice(0, 500))

    if (!raw || !Array.isArray(raw)) {
      return { times: null, scheduledHint: null, raw, selectedIndex: null, totalLegs: 0, status: null }
    }

    const data = raw as AeroDataBoxFlight[]
    if (data.length === 0) {
      return { times: null, scheduledHint: null, raw, selectedIndex: null, totalLegs: 0, status: null }
    }

    // Filter by origin airport if provided (handles turn flights with same flight number)
    const candidates = originIata
      ? data.filter(f => f.departure?.airport?.iata?.toUpperCase() === originIata.toUpperCase())
      : data

    const pool = candidates.length > 0 ? candidates : data

    // Prefer a completed leg (has actual arrival)
    const flight = pool.find(f => f.arrival?.actualTimeUtc || f.arrival?.actualTime?.utc) ?? pool[0]
    const selectedIndex = data.indexOf(flight)

    console.log(`[AeroDataBox] ${data.length} leg(s), using index ${selectedIndex}, origin filter="${originIata ?? 'none'}", status="${flight.status}"`)
    console.log('[AeroDataBox] selected leg:', JSON.stringify(flight))

    // Support both response shapes (nested .utc and flat)
    const depActual  = flight.departure?.actualTimeUtc  ?? flight.departure?.actualTime?.utc  ?? null
    const depRunway  = flight.departure?.runwayTimeUtc  ?? flight.departure?.runwayTime?.utc  ?? null
    const arrRunway  = flight.arrival?.runwayTimeUtc    ?? flight.arrival?.runwayTime?.utc    ?? null
    const arrActual  = flight.arrival?.actualTimeUtc    ?? flight.arrival?.actualTime?.utc    ?? null
    const depSched   = flight.departure?.scheduledTimeUtc ?? flight.departure?.scheduledTime?.utc ?? null
    const arrSched   = flight.arrival?.scheduledTimeUtc   ?? flight.arrival?.scheduledTime?.utc   ?? null

    const hasGateTimes   = !!(depActual || arrActual)
    const hasRunwayTimes = !!(depRunway || arrRunway)

    const tail    = flight.aircraft?.reg ?? null
    const acType  = mapAircraftType(flight.aircraft?.model ?? '')
    const origin  = flight.departure?.airport?.iata ?? null
    const dest    = flight.arrival?.airport?.iata ?? null

    // AeroDataBox ambiguity:
    //   When BOTH actualTime + runwayTime are present:
    //     actualTime = gate times (OUT/IN), runwayTime = air times (OFF/ON)  ✓
    //   When ONLY actualTime is present (no runwayTime):
    //     actualTime actually contains runway/air times (OFF/ON), NOT gate times
    //     → map to OFF/ON only, leave OUT/IN null
    let outUtc: string | null = null
    let offUtc: string | null = null
    let onUtc:  string | null = null
    let inUtc:  string | null = null
    let gateTimesUnavailable = false

    if (hasGateTimes && hasRunwayTimes) {
      // Full data: actualTime=gate, runwayTime=air
      outUtc = depActual
      offUtc = depRunway
      onUtc  = arrRunway
      inUtc  = arrActual
    } else if (hasGateTimes && !hasRunwayTimes) {
      // Only actualTime returned — these are runway/air times, not gate times
      outUtc = null
      offUtc = depActual
      onUtc  = arrActual
      inUtc  = null
      gateTimesUnavailable = true
    } else if (!hasGateTimes && hasRunwayTimes) {
      // Only runway times (unusual)
      outUtc = null
      offUtc = depRunway
      onUtc  = arrRunway
      inUtc  = null
      gateTimesUnavailable = true
    }

    const hasAnyActual = hasGateTimes || hasRunwayTimes

    return {
      times: hasAnyActual ? {
        outUtc, offUtc, onUtc, inUtc,
        tailNumber: tail, aircraftType: acType, origin, destination: dest,
        gateTimesUnavailable,
      } : null,
      scheduledHint: depSched || arrSched ? {
        outUtc: depSched, offUtc: null,
        onUtc: null,      inUtc: arrSched,
        tailNumber: tail, aircraftType: acType, origin, destination: dest,
        gateTimesUnavailable: false,
      } : null,
      raw,
      selectedIndex,
      totalLegs: data.length,
      status: flight.status ?? null,
    }
  } catch (err) {
    console.error('AeroDataBox fetch error:', err)
    return { times: null, scheduledHint: null, raw: null, selectedIndex: null, totalLegs: 0, status: null }
  }
}

interface AeroDataBoxFlight {
  number?: string
  status?: string
  departure?: {
    airport?: { iata?: string }
    scheduledTime?: { utc?: string }
    actualTime?: { utc?: string }
    runwayTime?: { utc?: string }
    // older response shape (both observed in the wild)
    scheduledTimeUtc?: string
    actualTimeUtc?: string
    runwayTimeUtc?: string
  }
  arrival?: {
    airport?: { iata?: string }
    scheduledTime?: { utc?: string }
    actualTime?: { utc?: string }
    runwayTime?: { utc?: string }
    scheduledTimeUtc?: string
    actualTimeUtc?: string
    runwayTimeUtc?: string
  }
  aircraft?: {
    reg?: string
    model?: string
  }
}

function mapAircraftType(model: string): string | null {
  if (!model) return null
  const m = model.toUpperCase()
  if (m.includes('170') || m.includes('ERJ-170')) return 'E170'
  if (m.includes('175') || m.includes('ERJ-175')) return 'E175'
  return model
}
