import { describe, it, expect } from 'vitest'
import {
  blockHours,
  flightHours,
  decimalToHHMM,
  minutesToDecimal,
  formatDurationHM,
} from '@/lib/utils/format'

describe('blockHours', () => {
  it('calculates hours for a same-day flight', () => {
    expect(blockHours('2024-01-15T10:00:00Z', '2024-01-15T12:30:00Z')).toBe(2.5)
  })

  it('calculates hours for an overnight flight', () => {
    expect(blockHours('2024-01-15T23:00:00Z', '2024-01-16T01:30:00Z')).toBe(2.5)
  })

  it('returns 0 for same in/out time', () => {
    expect(blockHours('2024-01-15T10:00:00Z', '2024-01-15T10:00:00Z')).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // 1 hour 1 minute = 1.0167 hours → rounds to 1.02
    expect(blockHours('2024-01-15T10:00:00Z', '2024-01-15T11:01:00Z')).toBe(1.02)
  })
})

describe('flightHours', () => {
  it('calculates wheels-off to wheels-on time', () => {
    expect(flightHours('2024-01-15T10:05:00Z', '2024-01-15T11:55:00Z')).toBe(1.83)
  })

  it('handles Date objects', () => {
    const off = new Date('2024-01-15T10:00:00Z')
    const on = new Date('2024-01-15T11:00:00Z')
    expect(flightHours(off, on)).toBe(1)
  })
})

describe('decimalToHHMM', () => {
  it('converts 1.5 to 01:30', () => {
    expect(decimalToHHMM(1.5)).toBe('01:30')
  })

  it('converts 0 to 00:00', () => {
    expect(decimalToHHMM(0)).toBe('00:00')
  })

  it('converts 0.25 to 00:15', () => {
    expect(decimalToHHMM(0.25)).toBe('00:15')
  })

  it('converts 10.0 to 10:00', () => {
    expect(decimalToHHMM(10)).toBe('10:00')
  })

  it('converts 2.75 to 02:45', () => {
    expect(decimalToHHMM(2.75)).toBe('02:45')
  })
})

describe('minutesToDecimal', () => {
  it('converts 90 minutes to 1.5 hours', () => {
    expect(minutesToDecimal(90)).toBe(1.5)
  })

  it('converts 0 to 0', () => {
    expect(minutesToDecimal(0)).toBe(0)
  })

  it('converts 60 to 1.0', () => {
    expect(minutesToDecimal(60)).toBe(1)
  })
})

describe('formatDurationHM', () => {
  it('returns minutes only when hours is 0', () => {
    expect(formatDurationHM(0.5)).toBe('30m')
  })

  it('returns hours only when minutes is 0', () => {
    expect(formatDurationHM(2)).toBe('2h')
  })

  it('returns both hours and minutes', () => {
    expect(formatDurationHM(1.5)).toBe('1h 30m')
  })
})
