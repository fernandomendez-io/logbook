import { describe, it, expect } from 'vitest'
import { calculatePayPeriod, detectMisconnect } from '@/lib/pay/calculator'
import type { Flight } from '@/lib/supabase/types'

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: 'test-id',
    pilot_id: 'pilot-1',
    sequence_id: null,
    duty_period_id: null,
    flight_number: 'MQ3779',
    operating_carrier: 'MQ_AA',
    origin_icao: 'CLT',
    destination_icao: 'DFW',
    scheduled_out_utc: '2024-01-15T11:00:00Z',
    scheduled_in_utc: '2024-01-15T13:00:00Z',
    actual_out_utc: null,
    actual_off_utc: null,
    actual_on_utc: null,
    actual_in_utc: null,
    block_scheduled_hrs: 2.0,
    block_actual_hrs: 2.0,
    flight_hrs: null,
    night_time_hrs: null,
    aircraft_type: 'E175',
    tail_number: null,
    seat: 'FO',
    approach_type: null,
    landing_count: 1,
    is_deadhead: false,
    is_cancelled: false,
    notes: null,
    fr24_raw: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    ...overrides,
  } as unknown as Flight
}

describe('calculatePayPeriod', () => {
  it('returns guarantee when no flights logged', () => {
    const result = calculatePayPeriod([], '2024-01-01', '2024-01-31')
    expect(result.totalCreditHrs).toBe(75)   // monthly guarantee
    expect(result.guaranteeApplied).toBe(75)
    expect(result.flightCount).toBe(0)
  })

  it('applies guarantee when actual credit is below 75h', () => {
    const flights = [makeFlight({ block_scheduled_hrs: 3.0, block_actual_hrs: 3.0 })]
    const result = calculatePayPeriod(flights, '2024-01-01', '2024-01-31')
    expect(result.creditHrs).toBe(3.0)
    expect(result.totalCreditHrs).toBe(75)
    expect(result.guaranteeApplied).toBe(72)
  })

  it('does not apply guarantee when credit exceeds 75h', () => {
    const flights = Array.from({ length: 30 }, () =>
      makeFlight({ block_scheduled_hrs: 3.0, block_actual_hrs: 3.0 })
    )
    const result = calculatePayPeriod(flights, '2024-01-01', '2024-01-31')
    expect(result.creditHrs).toBe(90)
    expect(result.guaranteeApplied).toBe(0)
    expect(result.totalCreditHrs).toBe(90)
  })

  it('credits deadhead at 50% of scheduled block', () => {
    const flights = [makeFlight({ is_deadhead: true, block_scheduled_hrs: 2.0, block_actual_hrs: 2.0 })]
    const result = calculatePayPeriod(flights, '2024-01-01', '2024-01-31')
    expect(result.deadheadHrs).toBe(1.0)   // 50% of 2.0
    expect(result.deadheadCount).toBe(1)
    expect(result.flightCount).toBe(0)
  })

  it('uses better-of rule (max of scheduled vs actual) per leg', () => {
    const flights = [
      makeFlight({ block_scheduled_hrs: 2.5, block_actual_hrs: 2.0 }),  // scheduled wins
      makeFlight({ block_scheduled_hrs: 1.5, block_actual_hrs: 1.8 }),  // actual wins
    ]
    const result = calculatePayPeriod(flights, '2024-01-01', '2024-01-31')
    expect(result.creditHrs).toBe(2.5 + 1.8)
  })

  it('skips cancelled flights', () => {
    const flights = [
      makeFlight({ block_scheduled_hrs: 2.0, is_cancelled: true }),
    ]
    const result = calculatePayPeriod(flights, '2024-01-01', '2024-01-31')
    expect(result.cancelledCount).toBe(1)
    expect(result.flightCount).toBe(0)
    expect(result.creditHrs).toBe(0)
  })

  it('accepts custom guarantee hours', () => {
    const result = calculatePayPeriod([], '2024-01-01', '2024-01-31', 80)
    expect(result.guaranteeHrs).toBe(80)
    expect(result.totalCreditHrs).toBe(80)
  })
})

describe('detectMisconnect', () => {
  it('returns true when connection time is less than 45 minutes', () => {
    const arrival = new Date('2024-01-15T10:30:00Z')
    const departure = new Date('2024-01-15T11:00:00Z')  // 30 min later
    expect(detectMisconnect(arrival, departure)).toBe(true)
  })

  it('returns false when connection time meets minimum', () => {
    const arrival = new Date('2024-01-15T10:00:00Z')
    const departure = new Date('2024-01-15T10:50:00Z')  // 50 min later
    expect(detectMisconnect(arrival, departure)).toBe(false)
  })

  it('uses custom minimum connection time', () => {
    const arrival = new Date('2024-01-15T10:00:00Z')
    const departure = new Date('2024-01-15T10:50:00Z')  // 50 min later
    expect(detectMisconnect(arrival, departure, 60)).toBe(true)
  })
})
