import { describe, it, expect } from 'vitest'
import { calculateNightTimeHrs } from '@/lib/utils/night-time'

describe('calculateNightTimeHrs', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(calculateNightTimeHrs([])).toBe(0)
    expect(calculateNightTimeHrs([{ lat: 40, lon: -74, timestamp: '2024-06-15T15:00:00Z' }])).toBe(0)
  })

  it('returns 0 for a short midday flight in summer (New York area)', () => {
    // June 15 noon to 2pm UTC — sun is well up at 40°N
    const points = [
      { lat: 40.6, lon: -73.8, timestamp: '2024-06-15T15:00:00Z' },
      { lat: 41.8, lon: -87.7, timestamp: '2024-06-15T17:00:00Z' },
    ]
    expect(calculateNightTimeHrs(points)).toBe(0)
  })

  it('returns non-zero night time for a midnight flight', () => {
    // Jan 15 01:00 to 03:00 UTC — deep night at 40°N
    const points = [
      { lat: 40.6, lon: -73.8, timestamp: '2024-01-15T06:00:00Z' },
      { lat: 41.8, lon: -87.7, timestamp: '2024-01-15T08:00:00Z' },
    ]
    const night = calculateNightTimeHrs(points)
    expect(night).toBeGreaterThan(0)
  })

  it('returns a number rounded to 2 decimal places', () => {
    const points = [
      { lat: 40, lon: -74, timestamp: '2024-01-15T00:00:00Z' },
      { lat: 40, lon: -74, timestamp: '2024-01-15T04:00:00Z' },
    ]
    const result = calculateNightTimeHrs(points)
    expect(result).toBe(Math.round(result * 100) / 100)
  })
})
