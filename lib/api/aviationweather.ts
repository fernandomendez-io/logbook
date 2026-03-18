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
    // Pass the target time as the reference date so the API returns historical METARs
    // around the actual landing time, not just the last 2 hours from now.
    // AWC date format: YYYYMMDDTHHmmZ (compact ISO)
    const dateStr = atTimeUtc.toISOString().replace(/[-:]/g, '').slice(0, 13) + 'Z'
    const url = `${BASE_URL}/metar?ids=${stationIcao}&format=json&date=${dateStr}&hours=2`

    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`METAR fetch failed: ${res.status}`)

    const data: AWCMetarRecord[] = await res.json()
    if (!data || data.length === 0) return null

    // Sort by observation time descending, pick the most recent one at or before atTimeUtc
    const target = atTimeUtc.getTime()
    const sorted = data
      .map(r => ({ ...r, ts: new Date(r.obsTime).getTime() }))
      .filter(r => r.ts <= target)
      .sort((a, b) => b.ts - a.ts)

    if (sorted.length === 0) {
      // No obs before the time — take the earliest available
      const earliest = [...data].sort((a, b) =>
        new Date(a.obsTime).getTime() - new Date(b.obsTime).getTime()
      )[0]
      return {
        stationId: earliest.stationId,
        observationTime: earliest.obsTime,
        rawOb: earliest.rawOb,
      }
    }

    const closest = sorted[0]
    return {
      stationId: closest.stationId,
      observationTime: closest.obsTime,
      rawOb: closest.rawOb,
    }
  } catch (err) {
    console.error('Aviation Weather fetch error:', err)
    return null
  }
}

interface AWCMetarRecord {
  stationId: string
  obsTime: string
  rawOb: string
  temp?: number
  dewp?: number
  wdir?: number
  wspd?: number
  visib?: number
  altim?: number
}
