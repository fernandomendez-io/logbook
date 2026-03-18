import { describe, it, expect } from 'vitest'
import { calculateLogbookTotals } from '@/lib/aviation/logbook'
import type { Database } from '@/lib/supabase/types'

type Flight = Database['public']['Tables']['flights']['Row']

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: crypto.randomUUID(),
    pilot_id: 'pilot-1',
    flight_number: 'MQ3779',
    origin_icao: 'KDFW',
    destination_icao: 'KORD',
    scheduled_out_utc: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    scheduled_in_utc: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 7200000).toISOString(),
    actual_out_utc: null,
    actual_in_utc: null,
    actual_off_utc: null,
    actual_on_utc: null,
    block_scheduled_hrs: 2.0,
    block_actual_hrs: 2.1,
    flight_time_hrs: 1.8,
    night_time_hrs: 0,
    aircraft_type: 'E175',
    tail_number: null,
    pilot_flying: 'FO',
    pilot_monitoring: null,
    landing_pilot: null,
    approach_type: null,
    approach_runway: null,
    notes: null,
    is_deadhead: false,
    is_positioning: false,
    is_cancelled: false,
    cancellation_code: null,
    had_diversion: false,
    had_go_around: false,
    had_return_to_gate: false,
    rtg_reason: null,
    cross_country: true,
    metar_raw: null,
    ceiling_ft: null,
    visibility_sm: null,
    weather_conditions: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sequence_id: null,
    duty_period_id: null,
    copilot_id: null,
    aircraft_id: null,
    diverted_to_icao: null,
    ...overrides,
  }
}

describe('calculateLogbookTotals', () => {
  it('returns all zeros for empty flights array', () => {
    const t = calculateLogbookTotals([])
    expect(t.totalFlights).toBe(0)
    expect(t.totalBlockHrs).toBe(0)
    expect(t.totalFlightHrs).toBe(0)
    expect(t.totalNightHrs).toBe(0)
    expect(t.picBlockHrs).toBe(0)
    expect(t.sicBlockHrs).toBe(0)
    expect(t.totalApproaches).toBe(0)
    expect(t.deadheadHrs).toBe(0)
    expect(t.cancelledCount).toBe(0)
    expect(t.deadheadCount).toBe(0)
    expect(t.landingsLast90Days).toBe(0)
    expect(t.nightLandingsLast90Days).toBe(0)
    expect(t.landingCurrencyMet).toBe(false)
  })

  it('counts non-cancelled, non-deadhead flights as totalFlights', () => {
    const flights = [
      makeFlight(),
      makeFlight({ is_cancelled: true }),
      makeFlight({ is_deadhead: true }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.totalFlights).toBe(1)
    expect(t.cancelledCount).toBe(1)
    expect(t.deadheadCount).toBe(1)
  })

  it('accumulates block time from block_actual_hrs, falling back to block_scheduled_hrs', () => {
    const flights = [
      makeFlight({ block_actual_hrs: 2.5, block_scheduled_hrs: 2.0 }),
      makeFlight({ block_actual_hrs: null, block_scheduled_hrs: 1.5 }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.totalBlockHrs).toBeCloseTo(4.0)
  })

  it('accumulates flight time and night time', () => {
    const flights = [
      makeFlight({ flight_time_hrs: 1.8, night_time_hrs: 0.5 }),
      makeFlight({ flight_time_hrs: 2.2, night_time_hrs: 1.0 }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.totalFlightHrs).toBeCloseTo(4.0)
    expect(t.totalNightHrs).toBeCloseTo(1.5)
  })

  it('splits block hours into PIC vs SIC by pilot_flying', () => {
    const flights = [
      makeFlight({ pilot_flying: 'CA', block_actual_hrs: 3.0 }),
      makeFlight({ pilot_flying: 'FO', block_actual_hrs: 2.0 }),
      makeFlight({ pilot_flying: 'unknown', block_actual_hrs: 1.0 }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.picBlockHrs).toBeCloseTo(3.0)
    expect(t.sicBlockHrs).toBeCloseTo(2.0)
    // unknown seat goes to neither PIC nor SIC
    expect(t.picBlockHrs + t.sicBlockHrs).toBeCloseTo(5.0)
  })

  it('excludes visual approaches from totalApproaches', () => {
    const flights = [
      makeFlight({ approach_type: 'visual' }),
      makeFlight({ approach_type: 'ILS' }),
      makeFlight({ approach_type: 'RNAV' }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.totalApproaches).toBe(2)
    expect(t.approachesByType['visual']).toBeUndefined()
  })

  it('builds approachesByType map correctly', () => {
    const flights = [
      makeFlight({ approach_type: 'ILS' }),
      makeFlight({ approach_type: 'ILS' }),
      makeFlight({ approach_type: 'RNAV' }),
      makeFlight({ approach_type: 'VOR' }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.approachesByType['ILS']).toBe(2)
    expect(t.approachesByType['RNAV']).toBe(1)
    expect(t.approachesByType['VOR']).toBe(1)
  })

  it('accumulates byAircraft block hours', () => {
    const flights = [
      makeFlight({ aircraft_type: 'E175', block_actual_hrs: 2.0 }),
      makeFlight({ aircraft_type: 'E175', block_actual_hrs: 1.5 }),
      makeFlight({ aircraft_type: 'E170', block_actual_hrs: 3.0 }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.byAircraft['E175']).toBeCloseTo(3.5)
    expect(t.byAircraft['E170']).toBeCloseTo(3.0)
  })

  it('excludes cancelled flights from all totals', () => {
    const flights = [
      makeFlight({ is_cancelled: true, block_actual_hrs: 5.0, approach_type: 'ILS' }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.totalBlockHrs).toBe(0)
    expect(t.totalApproaches).toBe(0)
    expect(t.cancelledCount).toBe(1)
  })

  it('deadhead legs count toward deadheadHrs but not totalBlockHrs', () => {
    const flights = [
      makeFlight({ is_deadhead: true, block_actual_hrs: 2.0 }),
      makeFlight({ is_deadhead: false, block_actual_hrs: 3.0 }),
    ]
    const t = calculateLogbookTotals(flights)
    expect(t.deadheadHrs).toBeCloseTo(2.0)
    expect(t.totalBlockHrs).toBeCloseTo(3.0)
  })

  it('counts last90DayApproaches correctly', () => {
    const now = new Date()
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

    const flights = [
      makeFlight({ scheduled_out_utc: daysAgo(30), approach_type: 'ILS' }),   // in 90d
      makeFlight({ scheduled_out_utc: daysAgo(60), approach_type: 'RNAV' }),  // in 90d
      makeFlight({ scheduled_out_utc: daysAgo(100), approach_type: 'VOR' }),  // outside 90d
    ]
    const t = calculateLogbookTotals(flights, null, now)
    expect(t.last90DayApproaches).toBe(2)
    expect(t.totalApproaches).toBe(3)
  })

  it('counts last6MonthApproaches correctly', () => {
    const now = new Date()
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

    const flights = [
      makeFlight({ scheduled_out_utc: daysAgo(30), approach_type: 'ILS' }),   // in 6mo
      makeFlight({ scheduled_out_utc: daysAgo(100), approach_type: 'ILS' }),  // in 6mo (182d)
      makeFlight({ scheduled_out_utc: daysAgo(200), approach_type: 'ILS' }),  // outside 6mo
    ]
    const t = calculateLogbookTotals(flights, null, now)
    expect(t.last6MonthApproaches).toBe(2)
  })

  it('computes last28DayBlockHrs and last365DayBlockHrs', () => {
    const now = new Date()
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

    const flights = [
      makeFlight({ scheduled_out_utc: daysAgo(7), block_actual_hrs: 2.0 }),   // in 28d & 365d
      makeFlight({ scheduled_out_utc: daysAgo(20), block_actual_hrs: 1.5 }),  // in 28d & 365d
      makeFlight({ scheduled_out_utc: daysAgo(40), block_actual_hrs: 3.0 }),  // in 365d only
      makeFlight({ scheduled_out_utc: daysAgo(400), block_actual_hrs: 5.0 }), // outside 365d
    ]
    const t = calculateLogbookTotals(flights, null, now)
    expect(t.last28DayBlockHrs).toBeCloseTo(3.5)
    expect(t.last365DayBlockHrs).toBeCloseTo(6.5)
  })

  describe('121.439 landing currency', () => {
    it('counts landings where pilot was landing_pilot matching their seat', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(10), landing_pilot: 'FO' }),
        makeFlight({ scheduled_out_utc: daysAgo(20), landing_pilot: 'FO' }),
        makeFlight({ scheduled_out_utc: daysAgo(30), landing_pilot: 'CA' }), // not FO
        makeFlight({ scheduled_out_utc: daysAgo(40), landing_pilot: 'FO' }),
      ]
      const t = calculateLogbookTotals(flights, 'FO', now)
      expect(t.landingsLast90Days).toBe(3) // 3 of 4 where landing_pilot = FO
    })

    it('excludes landings outside 90 days', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(80), landing_pilot: 'CA' }),  // in 90d
        makeFlight({ scheduled_out_utc: daysAgo(100), landing_pilot: 'CA' }), // outside 90d
      ]
      const t = calculateLogbookTotals(flights, 'CA', now)
      expect(t.landingsLast90Days).toBe(1)
    })

    it('counts night landings when flight has night_time_hrs > 0', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(5), landing_pilot: 'FO', night_time_hrs: 1.2 }),
        makeFlight({ scheduled_out_utc: daysAgo(10), landing_pilot: 'FO', night_time_hrs: 0 }),
        makeFlight({ scheduled_out_utc: daysAgo(15), landing_pilot: 'FO', night_time_hrs: 0.5 }),
      ]
      const t = calculateLogbookTotals(flights, 'FO', now)
      expect(t.landingsLast90Days).toBe(3)
      expect(t.nightLandingsLast90Days).toBe(2)
    })

    it('landingCurrencyMet is true when >= 3 day landings AND >= 1 night landing', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(5), landing_pilot: 'CA', night_time_hrs: 1.0 }),
        makeFlight({ scheduled_out_utc: daysAgo(10), landing_pilot: 'CA', night_time_hrs: 0 }),
        makeFlight({ scheduled_out_utc: daysAgo(15), landing_pilot: 'CA', night_time_hrs: 0 }),
      ]
      const t = calculateLogbookTotals(flights, 'CA', now)
      expect(t.landingCurrencyMet).toBe(true)
    })

    it('landingCurrencyMet is false when fewer than 3 landings', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(5), landing_pilot: 'CA', night_time_hrs: 1.0 }),
        makeFlight({ scheduled_out_utc: daysAgo(10), landing_pilot: 'CA', night_time_hrs: 0 }),
      ]
      const t = calculateLogbookTotals(flights, 'CA', now)
      expect(t.landingCurrencyMet).toBe(false)
    })

    it('landingCurrencyMet is false when no night landing', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(5), landing_pilot: 'CA', night_time_hrs: 0 }),
        makeFlight({ scheduled_out_utc: daysAgo(10), landing_pilot: 'CA', night_time_hrs: 0 }),
        makeFlight({ scheduled_out_utc: daysAgo(15), landing_pilot: 'CA', night_time_hrs: 0 }),
      ]
      const t = calculateLogbookTotals(flights, 'CA', now)
      expect(t.landingCurrencyMet).toBe(false)
    })

    it('returns 0 landings when pilotSeat is null (not set)', () => {
      const now = new Date()
      const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString()

      const flights = [
        makeFlight({ scheduled_out_utc: daysAgo(5), landing_pilot: 'CA' }),
      ]
      const t = calculateLogbookTotals(flights, null, now)
      expect(t.landingsLast90Days).toBe(0)
    })
  })
})
