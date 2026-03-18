import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMetarAtTime } from '@/lib/api/aviationweather'

const makeRecord = (obsTime: number, rawOb = 'KDFW 010000Z 00000KT 10SM CLR 20/10 A2992') => ({
  icaoId: 'KDFW',
  obsTime,
  rawOb,
})

function mockFetch(records: object[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => records,
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('fetchMetarAtTime', () => {
  it('converts obsTime seconds to milliseconds correctly', async () => {
    // Unix timestamp 1705312200 = 2024-01-15T06:30:00Z
    const obsTimeSec = 1705312200
    const expectedIso = new Date(obsTimeSec * 1000).toISOString()

    mockFetch([makeRecord(obsTimeSec)])

    const target = new Date(obsTimeSec * 1000 + 10 * 60000) // 10 min after obs
    const result = await fetchMetarAtTime('KDFW', target)

    expect(result).not.toBeNull()
    expect(result!.observationTime).toBe(expectedIso)
    // Sanity check: result is not a 1970 date
    expect(new Date(result!.observationTime).getFullYear()).toBe(2024)
  })

  it('uses icaoId as the returned stationId', async () => {
    const obsTimeSec = 1705312200
    mockFetch([makeRecord(obsTimeSec)])

    const target = new Date(obsTimeSec * 1000 + 5 * 60000)
    const result = await fetchMetarAtTime('KDFW', target)

    expect(result!.stationId).toBe('KDFW')
  })

  it('returns the observation closest to (and before) the target time', async () => {
    const t = 1705312200
    const records = [
      makeRecord(t - 3600, 'KDFW OLDER'),   // 1 hour before target
      makeRecord(t - 900, 'KDFW CLOSEST'),  // 15 min before target
    ]
    mockFetch(records)

    const target = new Date(t * 1000 + 5 * 60000)
    const result = await fetchMetarAtTime('KDFW', target)

    expect(result!.rawOb).toBe('KDFW CLOSEST')
  })

  it('falls back to earliest record when none are before target time', async () => {
    const t = 1705312200
    const records = [
      makeRecord(t + 3600, 'FUTURE_LATE'),
      makeRecord(t + 900, 'FUTURE_EARLY'),
    ]
    mockFetch(records)

    const target = new Date((t - 100) * 1000) // target is before both obs
    const result = await fetchMetarAtTime('KDFW', target)

    expect(result!.rawOb).toBe('FUTURE_EARLY')
  })

  it('returns null when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    const result = await fetchMetarAtTime('KDFW', new Date())
    expect(result).toBeNull()
  })

  it('returns null when API returns empty array', async () => {
    mockFetch([])
    const result = await fetchMetarAtTime('KDFW', new Date())
    expect(result).toBeNull()
  })

  it('returns null when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as any)
    const result = await fetchMetarAtTime('KDFW', new Date())
    expect(result).toBeNull()
  })
})

describe('toIcao (IATA normalization)', () => {
  // toIcao is in the route handler — test the logic here
  function toIcao(station: string): string {
    if (station.length === 3) return `K${station}`
    return station
  }

  it('prepends K to 3-letter US airports', () => {
    expect(toIcao('DFW')).toBe('KDFW')
    expect(toIcao('ORD')).toBe('KORD')
    expect(toIcao('LAX')).toBe('KLAX')
  })

  it('passes through 4-letter ICAO codes unchanged', () => {
    expect(toIcao('KDFW')).toBe('KDFW')
    expect(toIcao('EGLL')).toBe('EGLL')
  })
})
