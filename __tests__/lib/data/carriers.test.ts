import { describe, it, expect } from 'vitest'
import {
  CARRIERS,
  getDisplayPrefix,
  getSearchPrefix,
  prefixFlight,
  prefixFlightForSearch,
} from '@/lib/data/carriers'

describe('CARRIERS', () => {
  it('contains entries for major airlines', () => {
    const values = CARRIERS.map(c => c.value)
    expect(values).toContain('AA')
    expect(values).toContain('MQ_AA')
    expect(values).toContain('UA')
    expect(values).toContain('DL')
  })

  it('MQ_AA has MQ as displayPrefix and AA as searchPrefix', () => {
    const mq = CARRIERS.find(c => c.value === 'MQ_AA')!
    expect(mq.displayPrefix).toBe('MQ')
    expect(mq.searchPrefix).toBe('AA')
    expect(mq.mainline).toBe('AA')
  })

  it('YV_AA has YV as displayPrefix', () => {
    const yv = CARRIERS.find(c => c.value === 'YV_AA')!
    expect(yv.displayPrefix).toBe('YV')
  })
})

describe('getDisplayPrefix', () => {
  it('returns MQ for MQ_AA', () => {
    expect(getDisplayPrefix('MQ_AA')).toBe('MQ')
  })

  it('returns AA for AA', () => {
    expect(getDisplayPrefix('AA')).toBe('AA')
  })

  it('returns null for unknown carrier', () => {
    expect(getDisplayPrefix('UNKNOWN')).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(getDisplayPrefix(null)).toBeNull()
    expect(getDisplayPrefix(undefined)).toBeNull()
  })
})

describe('getSearchPrefix', () => {
  it('returns AA for MQ_AA (mainline search prefix)', () => {
    expect(getSearchPrefix('MQ_AA')).toBe('AA')
  })

  it('returns AA for YV_AA', () => {
    expect(getSearchPrefix('YV_AA')).toBe('AA')
  })

  it('returns UA for OO_UA', () => {
    expect(getSearchPrefix('OO_UA')).toBe('UA')
  })

  it('returns null for unknown carrier', () => {
    expect(getSearchPrefix('UNKNOWN')).toBeNull()
  })
})

describe('prefixFlight', () => {
  it('prepends MQ to a bare flight number for Envoy', () => {
    expect(prefixFlight('3779', 'MQ_AA')).toBe('MQ3779')
  })

  it('does not double-prefix an already-prefixed flight number', () => {
    expect(prefixFlight('MQ3779', 'MQ_AA')).toBe('MQ3779')
  })

  it('returns the bare number if carrier is unknown', () => {
    expect(prefixFlight('3779', 'UNKNOWN')).toBe('3779')
  })

  it('returns the bare number if carrier is null', () => {
    expect(prefixFlight('3779', null)).toBe('3779')
  })
})

describe('prefixFlightForSearch', () => {
  it('returns AA-prefixed number for MQ_AA (FlightAware search)', () => {
    expect(prefixFlightForSearch('3779', 'MQ_AA')).toBe('AA3779')
  })

  it('strips display prefix before adding search prefix', () => {
    // If user stored "AA3779" we should still produce "AA3779"
    expect(prefixFlightForSearch('AA3779', 'MQ_AA')).toBe('AA3779')
  })

  it('returns bare number for unknown carrier', () => {
    expect(prefixFlightForSearch('3779', 'UNKNOWN')).toBe('3779')
  })
})
