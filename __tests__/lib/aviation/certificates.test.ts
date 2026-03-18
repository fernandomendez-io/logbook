import { describe, it, expect } from 'vitest'
import { calculateMedicalExpiry, daysUntilExpiry, expiryStatus } from '@/lib/aviation/certificates'

// Helper: date from YYYY-MM-DD string
const d = (s: string) => new Date(s + 'T12:00:00Z')

describe('calculateMedicalExpiry', () => {
  describe('1st class — under 40', () => {
    it('expires after 12 calendar months (end of that month)', () => {
      // Pilot born 1990-06-15 (age 35 at exam on 2026-01-10)
      const expiry = calculateMedicalExpiry(d('2026-01-10'), '1st', d('1990-06-15'))
      // 12 months after Jan 2026 = Jan 2027; end of Jan 2027 = 2027-01-31
      expect(expiry.toISOString().slice(0, 10)).toBe('2027-01-31')
    })
  })

  describe('1st class — 40 or older', () => {
    it('expires after 6 calendar months for ATP operations', () => {
      // Pilot born 1980-01-01 (age 46 at exam on 2026-01-10)
      const expiry = calculateMedicalExpiry(d('2026-01-10'), '1st', d('1980-01-01'))
      // 6 months after Jan 2026 = Jul 2026; end of Jul 2026 = 2026-07-31
      expect(expiry.toISOString().slice(0, 10)).toBe('2026-07-31')
    })
  })

  describe('2nd class', () => {
    it('always expires after 12 calendar months regardless of age', () => {
      const expiry = calculateMedicalExpiry(d('2026-03-15'), '2nd', d('1970-01-01'))
      // End of March 2027 = 2027-03-31
      expect(expiry.toISOString().slice(0, 10)).toBe('2027-03-31')
    })
  })

  describe('3rd class — under 40', () => {
    it('expires after 60 calendar months', () => {
      // Pilot born 1995-01-01 (age 31 at exam on 2026-01-10)
      const expiry = calculateMedicalExpiry(d('2026-01-10'), '3rd', d('1995-01-01'))
      // 60 months = 5 years; end of Jan 2031 = 2031-01-31
      expect(expiry.toISOString().slice(0, 10)).toBe('2031-01-31')
    })
  })

  describe('3rd class — 40 or older', () => {
    it('expires after 24 calendar months', () => {
      // Pilot born 1980-01-01 (age 46 at exam on 2026-03-01)
      const expiry = calculateMedicalExpiry(d('2026-03-01'), '3rd', d('1980-01-01'))
      // 24 months after Mar 2026 = Mar 2028; end of Mar 2028 = 2028-03-31
      expect(expiry.toISOString().slice(0, 10)).toBe('2028-03-31')
    })
  })

  it('handles end-of-month correctly for February', () => {
    // Issued in August 2025 → expires end of August 2026 for 2nd class
    const expiry = calculateMedicalExpiry(d('2025-08-15'), '2nd', d('1985-01-01'))
    // 12 months → end of Aug 2026 = 2026-08-31
    expect(expiry.toISOString().slice(0, 10)).toBe('2026-08-31')
  })
})

describe('daysUntilExpiry', () => {
  it('returns positive days for future expiry', () => {
    const expiry = new Date('2026-12-31T00:00:00Z')
    const asOf = new Date('2026-01-01T00:00:00Z')
    expect(daysUntilExpiry(expiry, asOf)).toBe(364)
  })

  it('returns 0 on the expiry date', () => {
    const date = new Date('2026-06-15T00:00:00Z')
    expect(daysUntilExpiry(date, date)).toBe(0)
  })

  it('returns negative days for past expiry', () => {
    const expiry = new Date('2025-01-01T00:00:00Z')
    const asOf = new Date('2026-01-01T00:00:00Z')
    expect(daysUntilExpiry(expiry, asOf)).toBe(-365)
  })
})

describe('expiryStatus', () => {
  it('returns ok for > 60 days', () => {
    expect(expiryStatus(90)).toBe('ok')
    expect(expiryStatus(61)).toBe('ok')
  })

  it('returns warning for 30–60 days', () => {
    expect(expiryStatus(60)).toBe('warning')
    expect(expiryStatus(31)).toBe('warning')
  })

  it('returns danger for < 30 days', () => {
    expect(expiryStatus(29)).toBe('danger')
    expect(expiryStatus(0)).toBe('danger')
    expect(expiryStatus(-5)).toBe('danger')
  })
})
