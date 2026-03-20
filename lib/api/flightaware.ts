/**
 * FlightAware AeroAPI v4 client
 * https://www.flightaware.com/aeroapi/portal/documentation
 *
 * Two-step fetch:
 *   1. GET /flights/{ident}          — OOOI times, fa_flight_id, gates, aircraft
 *   2. GET /flights/{fa_flight_id}/track — full position track with alt/speed/heading
 *
 * OOOI mapping:
 *   actual_out → OUT   actual_off → OFF   actual_on → ON   actual_in → IN
 */

const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi'

// ─── Shared types (kept compatible with existing callers) ──────────────────────

export interface TrackPoint {
  timestamp: string    // ISO 8601
  lat: number
  lon: number
  alt: number          // feet (converted from AeroAPI hundreds-of-feet if needed)
  gspeed: number       // knots
  heading: number      // degrees
  altChange: 'C' | 'D' | '-' | ''
}

export interface ACARSTimes {
  outUtc: string | null
  offUtc: string | null
  onUtc: string | null
  inUtc: string | null
  tailNumber: string | null
  aircraftType: string | null
  origin: string | null
  destination: string | null
  departureGate?: string | null
  arrivalGate?: string | null
  departureRunway?: string | null
  landingRunway?: string | null
  cruiseGspeedKts?: number | null
  cruiseAltFt?: number | null
  descentStartUtc?: string | null
  // airspaceTransitions removed — not available in AeroAPI
  gateTimesUnavailable?: boolean
}

export interface ACARSResult {
  times: ACARSTimes | null
  scheduledHint: ACARSTimes | null
  raw: unknown
  faFlightId: string | null
  selectedIndex: number | null
  totalLegs: number
  status: string | null
  track: TrackPoint[]
}

// ─── AeroAPI response shapes ───────────────────────────────────────────────────

interface FAFlightOriginDest {
  code?: string
  code_icao?: string
  code_iata?: string
  city?: string
  name?: string
}

interface FAFlight {
  fa_flight_id: string
  ident?: string
  ident_icao?: string
  ident_iata?: string
  flight_number?: string
  registration?: string
  aircraft_type?: string
  status?: string
  origin?: FAFlightOriginDest
  destination?: FAFlightOriginDest
  scheduled_out?: string | null
  scheduled_off?: string | null
  scheduled_on?: string | null
  scheduled_in?: string | null
  estimated_out?: string | null
  estimated_off?: string | null
  estimated_on?: string | null
  estimated_in?: string | null
  actual_out?: string | null
  actual_off?: string | null
  actual_on?: string | null
  actual_in?: string | null
  gate_origin?: string | null
  gate_destination?: string | null
  runway_off?: string | null
  runway_on?: string | null
  diverted?: boolean
  cancelled?: boolean
}

interface FAFlightsResponse {
  flights: FAFlight[]
  num_pages?: number
}

interface FATrackPosition {
  fa_flight_id?: string
  timestamp: string
  lat: number
  // AeroAPI uses "long" — handle both "long" and "longitude"
  long?: number
  longitude?: number
  altitude: number    // hundreds of feet (FL180 = 180)
  groundspeed: number // knots
  heading?: number
  altitude_change?: string
  update_type?: string
}

interface FATrackResponse {
  positions: FATrackPosition[]
}

// ─── Auth / fetch helper ───────────────────────────────────────────────────────

async function faFetch(path: string, params?: Record<string, string>): Promise<unknown> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY
  if (!apiKey) throw new Error('FLIGHTAWARE_API_KEY not configured')

  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-apikey': apiKey,
      'Accept': 'application/json; charset=UTF-8',
    },
    next: { revalidate: 3600 },
  })

  const text = await response.text()
  if (!response.ok) {
    console.error(`[FA] ${response.status} ${path}: ${text.slice(0, 400)}`)
    throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`)
  }
  if (!text || text.trim() === '' || text.trim() === 'null') return null
  try {
    return JSON.parse(text)
  } catch {
    console.error('[FA] Non-JSON response:', text.slice(0, 400))
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapAircraftType(icaoType?: string | null): string | null {
  if (!icaoType) return null
  const t = icaoType.toUpperCase()
  if (t === 'E170' || t === 'E17L' || t === 'E17S') return 'E170'
  if (t === 'E75L' || t === 'E75S' || t === 'E175' || t.includes('175')) return 'E175'
  return icaoType
}

function iataFromFAOrigin(od?: FAFlightOriginDest | null): string | null {
  if (!od) return null
  return od.code_iata ?? (od.code_icao?.length === 4 ? od.code_icao.slice(1) : od.code_icao) ?? od.code ?? null
}

function icaoFromFAOrigin(od?: FAFlightOriginDest | null): string | null {
  if (!od) return null
  return od.code_icao ?? od.code ?? null
}

function matchesOrigin(flight: FAFlight, originIata: string): boolean {
  const iata = originIata.toUpperCase()
  const fIata = iataFromFAOrigin(flight.origin)?.toUpperCase()
  const fIcao = icaoFromFAOrigin(flight.origin)?.toUpperCase()
  if (fIata === iata) return true
  if (fIcao === `K${iata}`) return true
  if (fIcao === iata) return true
  return false
}

/** Convert AeroAPI altitude (hundreds of feet) to feet. AeroAPI docs say
 *  altitude is in hundreds of feet for enroute but may be raw feet on ground.
 *  Heuristic: if value < 600 and looks like FL notation, multiply by 100. */
function normAlt(raw: number): number {
  if (raw <= 0) return 0
  // AeroAPI returns altitude in hundreds of feet for airborne positions
  // Values like 180 = FL180 = 18000 ft; values like 0 = ground
  if (raw < 600) return raw * 100
  // Already in feet (some endpoints return raw feet)
  return raw
}

// ─── Derive flight stats from track ──────────────────────────────────────────

export interface FlightStats {
  cruiseAltFt: number | null
  cruiseGspeedKts: number | null
  descentStartUtc: string | null
  distanceNm: number
  maxAltFt: number | null
  avgCruiseGspeedKts: number | null
  climbRateFpm: number | null
  descentRateFpm: number | null
}

export function deriveFlightStats(track: TrackPoint[]): FlightStats {
  if (track.length < 2) {
    return { cruiseAltFt: null, cruiseGspeedKts: null, descentStartUtc: null, distanceNm: 0, maxAltFt: null, avgCruiseGspeedKts: null, climbRateFpm: null, descentRateFpm: null }
  }

  // Max altitude
  const maxAlt = Math.max(...track.map(p => p.alt))
  const cruiseThreshold = maxAlt * 0.92  // within 8% of max = cruise

  // Find cruise segment
  const cruisePoints = track.filter(p => p.alt >= cruiseThreshold && p.gspeed > 0)
  const cruiseAltFt = cruisePoints.length > 0
    ? Math.round(cruisePoints.reduce((s, p) => s + p.alt, 0) / cruisePoints.length)
    : (maxAlt > 0 ? maxAlt : null)
  const avgCruiseGspeedKts = cruisePoints.length > 0
    ? Math.round(cruisePoints.reduce((s, p) => s + p.gspeed, 0) / cruisePoints.length)
    : null

  // Cruise groundspeed at peak altitude
  const peakPoint = track.reduce((best, p) => p.alt > best.alt ? p : best, track[0])

  // Top of descent: last point in cruise before consistent descent
  let descentStartUtc: string | null = null
  if (cruiseAltFt && cruiseAltFt > 5000) {
    // Find the last point that is at cruise altitude before the aircraft begins sustained descent
    for (let i = track.length - 1; i >= 0; i--) {
      if (track[i].alt >= cruiseThreshold) {
        // Make sure there are descending points after this
        const afterPoints = track.slice(i + 1)
        if (afterPoints.length >= 3 && afterPoints.every(p => p.alt < cruiseThreshold)) {
          descentStartUtc = track[i + 1]?.timestamp ?? null
          break
        }
      }
    }
    // Fallback: find first sustained descent from cruise
    if (!descentStartUtc) {
      const peakIdx = track.indexOf(peakPoint)
      for (let i = peakIdx; i < track.length - 3; i++) {
        if (track[i].alt > track[i + 1].alt &&
            track[i + 1].alt > track[i + 2].alt &&
            track[i + 2].alt > track[i + 3]?.alt) {
          descentStartUtc = track[i].timestamp
          break
        }
      }
    }
  }

  // Distance (great-circle sum)
  let distanceNm = 0
  for (let i = 0; i < track.length - 1; i++) {
    distanceNm += greatCircleNm(track[i].lat, track[i].lon, track[i + 1].lat, track[i + 1].lon)
  }
  distanceNm = Math.round(distanceNm)

  // Climb rate (avg fpm from first airborne to cruise)
  let climbRateFpm: number | null = null
  const firstAirborne = track.find(p => p.alt > 500)
  const peakIdx = track.indexOf(peakPoint)
  if (firstAirborne && peakIdx > 0) {
    const firstIdx = track.indexOf(firstAirborne)
    const altGain = peakPoint.alt - firstAirborne.alt
    const timeMin = (new Date(peakPoint.timestamp).getTime() - new Date(firstAirborne.timestamp).getTime()) / 60000
    if (timeMin > 0 && altGain > 0) climbRateFpm = Math.round(altGain / timeMin)
  }

  // Descent rate (avg fpm from TOD to last airborne)
  let descentRateFpm: number | null = null
  if (descentStartUtc) {
    const todIdx = track.findIndex(p => p.timestamp === descentStartUtc)
    const lastAirborne = [...track].reverse().find(p => p.alt > 500)
    if (todIdx >= 0 && lastAirborne) {
      const lastIdx = track.lastIndexOf(lastAirborne)
      const altLoss = track[todIdx].alt - lastAirborne.alt
      const timeMin = (new Date(lastAirborne.timestamp).getTime() - new Date(track[todIdx].timestamp).getTime()) / 60000
      if (timeMin > 0 && altLoss > 0) descentRateFpm = Math.round(altLoss / timeMin)
    }
  }

  return {
    cruiseAltFt,
    cruiseGspeedKts: peakPoint.gspeed > 0 ? peakPoint.gspeed : avgCruiseGspeedKts,
    descentStartUtc,
    distanceNm,
    maxAltFt: maxAlt > 0 ? maxAlt : null,
    avgCruiseGspeedKts,
    climbRateFpm,
    descentRateFpm,
  }
}

function greatCircleNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065  // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchFlightAwareTrack(faFlightId: string): Promise<TrackPoint[]> {
  try {
    const raw = await faFetch(`/flights/${encodeURIComponent(faFlightId)}/track`)
    const resp = raw as FATrackResponse | null
    if (!resp?.positions?.length) return []

    return resp.positions
      .filter(p => p.lat != null && (p.long != null || p.longitude != null))
      .map(p => ({
        timestamp: p.timestamp,
        lat: p.lat,
        lon: p.long ?? p.longitude ?? 0,
        alt: normAlt(p.altitude),
        gspeed: p.groundspeed ?? 0,
        heading: p.heading ?? 0,
        altChange: (p.altitude_change as TrackPoint['altChange']) ?? '',
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  } catch (err) {
    console.error('[FA] track fetch error:', err)
    return []
  }
}

export async function fetchFlightAwareFlight(
  flightIdent: string,
  date: string,
  originIata?: string,
): Promise<ACARSResult> {
  try {
    const raw = await faFetch(`/flights/${encodeURIComponent(flightIdent)}`, {
      start: `${date}T00:00:00Z`,
      end: `${date}T23:59:59Z`,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`[FA] ── GET /flights/${flightIdent} (${date}) ──`)
      console.dir(raw, { depth: null })
    }

    const resp = raw as FAFlightsResponse | null
    if (!resp?.flights?.length) {
      return { times: null, scheduledHint: null, raw, faFlightId: null, selectedIndex: null, totalLegs: 0, status: null, track: [] }
    }

    const data = resp.flights
    const candidates = originIata ? data.filter(f => matchesOrigin(f, originIata)) : data
    const pool = candidates.length > 0 ? candidates : data

    // Prefer a leg that has actually landed, fallback to first
    const leg = pool.find(f => f.actual_on || f.actual_in) ?? pool[0]
    const selectedIndex = data.indexOf(leg)

    if (process.env.NODE_ENV === 'development') {
      console.log(`[FA] ${data.length} leg(s) — selected index=${selectedIndex}, fa_flight_id="${leg.fa_flight_id}"`)
    }

    const tail = leg.registration ?? null
    const acType = mapAircraftType(leg.aircraft_type)
    const originIataCode = iataFromFAOrigin(leg.origin)
    const destIataCode = iataFromFAOrigin(leg.destination)

    const outUtc = leg.actual_out ?? null
    const offUtc = leg.actual_off ?? null
    const onUtc = leg.actual_on ?? null
    const inUtc = leg.actual_in ?? null
    const hasGateTimes = !!(outUtc || inUtc)
    const hasAirTimes = !!(offUtc || onUtc)

    // Fetch track in parallel (we already have the fa_flight_id)
    const track = await fetchFlightAwareTrack(leg.fa_flight_id)
    const stats = track.length >= 5 ? deriveFlightStats(track) : null

    const times: ACARSTimes = {
      outUtc,
      offUtc,
      onUtc,
      inUtc,
      tailNumber: tail,
      aircraftType: acType,
      origin: originIataCode,
      destination: destIataCode,
      departureGate: leg.gate_origin ?? null,
      arrivalGate: leg.gate_destination ?? null,
      departureRunway: leg.runway_off ?? null,
      landingRunway: leg.runway_on ?? null,
      cruiseGspeedKts: stats?.cruiseGspeedKts ?? null,
      cruiseAltFt: stats?.cruiseAltFt ?? null,
      descentStartUtc: stats?.descentStartUtc ?? null,
      gateTimesUnavailable: hasAirTimes && !hasGateTimes,
    }

    return {
      times: hasAirTimes || hasGateTimes ? times : null,
      scheduledHint: {
        outUtc: leg.scheduled_out ?? null,
        offUtc: leg.scheduled_off ?? null,
        onUtc: leg.scheduled_on ?? null,
        inUtc: leg.scheduled_in ?? null,
        tailNumber: null,
        aircraftType: acType,
        origin: originIataCode,
        destination: destIataCode,
      },
      raw,
      faFlightId: leg.fa_flight_id,
      selectedIndex,
      totalLegs: data.length,
      status: leg.status ?? null,
      track,
    }
  } catch (err) {
    console.error('[FA] fetch error:', err)
    return { times: null, scheduledHint: null, raw: null, faFlightId: null, selectedIndex: null, totalLegs: 0, status: null, track: [] }
  }
}
