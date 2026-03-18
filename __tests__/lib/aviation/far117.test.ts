import { describe, it, expect } from 'vitest'
import {
  meetsMinimumRest,
  computeRest,
  maxFlightTimeDutyPeriod,
  buildFAR117Status,
  MIN_REST_HOURS,
  LIMIT_28D,
  LIMIT_365D,
} from '@/lib/aviation/far117'

describe('meetsMinimumRest', () => {
  it('returns true for exactly 10 hours rest', () => {
    expect(meetsMinimumRest(10)).toBe(true)
  })

  it('returns true for more than 10 hours rest', () => {
    expect(meetsMinimumRest(12)).toBe(true)
  })

  it('returns false for less than 10 hours rest', () => {
    expect(meetsMinimumRest(9.9)).toBe(false)
  })

  it('returns false for 0 hours', () => {
    expect(meetsMinimumRest(0)).toBe(false)
  })
})

describe('computeRest', () => {
  it('returns hours between two dates', () => {
    const release = new Date('2024-01-15T18:00:00Z')
    const report = new Date('2024-01-16T04:00:00Z')
    expect(computeRest(release, report)).toBe(10)
  })

  it('returns fractional hours', () => {
    const release = new Date('2024-01-15T18:00:00Z')
    const report = new Date('2024-01-16T03:30:00Z')
    expect(computeRest(release, report)).toBe(9.5)
  })
})

describe('maxFlightTimeDutyPeriod', () => {
  it('returns 9.0 for 1 segment (no WOCL)', () => {
    expect(maxFlightTimeDutyPeriod(1)).toBe(9.0)
  })

  it('returns 9.0 for 4 segments (no WOCL)', () => {
    expect(maxFlightTimeDutyPeriod(4)).toBe(9.0)
  })

  it('returns 8.0 for 3 segments with WOCL', () => {
    expect(maxFlightTimeDutyPeriod(3, true)).toBe(8.0)
  })

  it('caps at 4 segments (5+ returns same as 4)', () => {
    expect(maxFlightTimeDutyPeriod(5)).toBe(maxFlightTimeDutyPeriod(4))
  })
})

describe('buildFAR117Status', () => {
  it('returns compliant status with no violations when within limits', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 50,
      flightTime365dHrs: 500,
      dutyTime7dHrs: 30,
      lastDutyEndUtc: null,
    })
    expect(status.isCompliant).toBe(true)
    expect(status.violations).toHaveLength(0)
    expect(status.flightTime28dHrs).toBe(50)
    expect(status.flightTime365dHrs).toBe(500)
  })

  it('creates violation when 28-day limit exceeded', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 105,
      flightTime365dHrs: 800,
      dutyTime7dHrs: 40,
      lastDutyEndUtc: null,
    })
    expect(status.isCompliant).toBe(false)
    expect(status.violations.some(v => v.includes('28-day'))).toBe(true)
  })

  it('creates violation when 365-day limit exceeded', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 80,
      flightTime365dHrs: 1050,
      dutyTime7dHrs: 40,
      lastDutyEndUtc: null,
    })
    expect(status.isCompliant).toBe(false)
    expect(status.violations.some(v => v.includes('365-day'))).toBe(true)
  })

  it('adds warning at 85% of 28-day limit', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 86,   // 86% of 100
      flightTime365dHrs: 500,
      dutyTime7dHrs: 30,
      lastDutyEndUtc: null,
    })
    expect(status.isCompliant).toBe(true)
    expect(status.warnings.some(w => w.includes('28-day'))).toBe(true)
  })

  it('calculates nextDutyEarliestStart as 10h after lastDutyEndUtc', () => {
    const release = new Date('2024-01-15T18:00:00Z')
    const status = buildFAR117Status({
      flightTime28dHrs: 50,
      flightTime365dHrs: 500,
      dutyTime7dHrs: 30,
      lastDutyEndUtc: release,
    })
    const expected = new Date('2024-01-16T04:00:00Z')
    expect(status.nextDutyEarliestStart?.getTime()).toBe(expected.getTime())
  })

  it('returns null nextDutyEarliestStart when no last duty end', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 50,
      flightTime365dHrs: 500,
      dutyTime7dHrs: 30,
      lastDutyEndUtc: null,
    })
    expect(status.nextDutyEarliestStart).toBeNull()
  })

  it('exposes correct limits', () => {
    const status = buildFAR117Status({
      flightTime28dHrs: 0,
      flightTime365dHrs: 0,
      dutyTime7dHrs: 0,
      lastDutyEndUtc: null,
    })
    expect(status.flightTime28dLimit).toBe(LIMIT_28D)
    expect(status.flightTime365dLimit).toBe(LIMIT_365D)
    expect(status.restRequiredHrs).toBe(MIN_REST_HOURS)
  })
})
