/**
 * Aviation Weather Center (aviationweather.gov) METAR client
 * Free public API — no key required
 */

const BASE_URL = 'https://aviationweather.gov/api/data'

export interface RawMETARResult {
  stationId: string
  observationTime: string  // ISO UTC
  rawOb: string
}

/**
 * Fetch METARs for a station at or before a given time
 * Returns the closest observation to the requested time
 */
export async function fetchMetarAtTime(
  stationIcao: string,
  atTimeUtc: Date,
): Promise<RawMETARResult | null> {
  try {
    // AWC date format: YYYYMMDDTHHmmZ
    const dateStr = atTimeUtc.toISOString().replace(/[-:]/g, '').slice(0, 13) + 'Z'
    const url = `${BASE_URL}/metar?ids=${stationIcao}&format=json&date=${dateStr}&hours=2`

    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`METAR fetch failed: ${res.status}`)

    const data: AWCMetarRecord[] = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const target = atTimeUtc.getTime()

    // obsTime is Unix seconds — multiply by 1000 for milliseconds
    const sorted = data
      .map(r => ({ ...r, ts: r.obsTime * 1000 }))
      .filter(r => r.ts <= target)
      .sort((a, b) => b.ts - a.ts)

    if (sorted.length === 0) {
      // No obs before the target time — take the earliest available
      const earliest = [...data].sort((a, b) => a.obsTime - b.obsTime)[0]
      return {
        stationId: earliest.icaoId ?? stationIcao,
        observationTime: new Date(earliest.obsTime * 1000).toISOString(),
        rawOb: earliest.rawOb,
      }
    }

    const closest = sorted[0]
    return {
      stationId: closest.icaoId ?? stationIcao,
      observationTime: new Date(closest.obsTime * 1000).toISOString(),
      rawOb: closest.rawOb,
    }
  } catch (err) {
    console.error('[METAR] Aviation Weather fetch error:', err)
    return null
  }
}

// AWC JSON format — obsTime is Unix timestamp in SECONDS (not a string)
interface AWCMetarRecord {
  icaoId: string        // ICAO station identifier
  stationId?: string    // sometimes same as icaoId
  obsTime: number       // Unix timestamp in seconds
  rawOb: string         // raw METAR string
  temp?: number
  dewp?: number
  wdir?: number
  wspd?: number
  wgst?: number | null
  visib?: number
  altim?: number
}
