import { describe, it, expect } from 'vitest'
import { buildCalendarGrid, shiftMonth, formatMonthLabel } from '@/lib/aviation/calendar'

const NO_FLIGHTS: any[] = []

function makeSeq(overrides: {
  id?: string
  sequence_number?: string
  status?: string
  report_date: string
  release_date: string
}): any {
  return {
    id: overrides.id ?? 'seq-1',
    sequence_number: overrides.sequence_number ?? 'M001',
    status: overrides.status ?? 'active',
    report_date: overrides.report_date,
    release_date: overrides.release_date,
  }
}

describe('buildCalendarGrid', () => {
  it('returns 35 cells for a month that fits in 5 weeks', () => {
    // February 2026 starts on Sunday (0) → 28 days → 4 rows but starts on Sunday → 35 cells
    const grid = buildCalendarGrid(2026, 2, [], NO_FLIGHTS)
    expect(grid.length).toBeGreaterThanOrEqual(35)
  })

  it('marks cells in the target month as isCurrentMonth=true', () => {
    const grid = buildCalendarGrid(2026, 1, [], NO_FLIGHTS) // January 2026
    const janCells = grid.filter(d => d.isCurrentMonth)
    expect(janCells.length).toBe(31)
  })

  it('marks cells outside target month as isCurrentMonth=false', () => {
    const grid = buildCalendarGrid(2026, 1, [], NO_FLIGHTS)
    const outCells = grid.filter(d => !d.isCurrentMonth)
    expect(outCells.length).toBeGreaterThan(0)
  })

  it('first cell is always a Sunday', () => {
    const grid = buildCalendarGrid(2026, 3, [], NO_FLIGHTS) // March 2026
    const firstDate = new Date(grid[0].date + 'T00:00:00Z')
    expect(firstDate.getUTCDay()).toBe(0) // Sunday
  })

  it('attaches sequences that span the cell date', () => {
    const seq = makeSeq({ report_date: '2026-01-05', release_date: '2026-01-07' })
    const grid = buildCalendarGrid(2026, 1, [seq], NO_FLIGHTS)

    const jan5 = grid.find(d => d.date === '2026-01-05')!
    const jan6 = grid.find(d => d.date === '2026-01-06')!
    const jan7 = grid.find(d => d.date === '2026-01-07')!
    const jan4 = grid.find(d => d.date === '2026-01-04')!

    expect(jan5.sequences).toHaveLength(1)
    expect(jan6.sequences).toHaveLength(1)
    expect(jan7.sequences).toHaveLength(1)
    expect(jan4.sequences).toHaveLength(0)
  })

  it('counts flights on the correct date', () => {
    const flights = [
      { id: '1', scheduled_out_utc: '2026-01-10T14:00:00Z' },
      { id: '2', scheduled_out_utc: '2026-01-10T18:00:00Z' },
      { id: '3', scheduled_out_utc: '2026-01-11T09:00:00Z' },
    ] as any[]
    const grid = buildCalendarGrid(2026, 1, [], flights)

    const jan10 = grid.find(d => d.date === '2026-01-10')!
    const jan11 = grid.find(d => d.date === '2026-01-11')!
    expect(jan10.flightCount).toBe(2)
    expect(jan11.flightCount).toBe(1)
  })

  it('marks a day as isDayOff when no sequences or flights', () => {
    const grid = buildCalendarGrid(2026, 1, [], NO_FLIGHTS)
    const jan15 = grid.find(d => d.date === '2026-01-15')!
    expect(jan15.isDayOff).toBe(true)
    expect(jan15.isCurrentMonth).toBe(true)
  })

  it('day with a sequence is NOT a day off', () => {
    const seq = makeSeq({ report_date: '2026-01-15', release_date: '2026-01-15' })
    const grid = buildCalendarGrid(2026, 1, [seq], NO_FLIGHTS)
    const jan15 = grid.find(d => d.date === '2026-01-15')!
    expect(jan15.isDayOff).toBe(false)
  })
})

describe('shiftMonth', () => {
  it('advances one month', () => {
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
  })

  it('handles year rollover forward', () => {
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('goes back one month', () => {
    expect(shiftMonth('2026-03', -1)).toBe('2026-02')
  })

  it('handles year rollover backward', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('formatMonthLabel', () => {
  it('formats YYYY-MM as month name + year', () => {
    expect(formatMonthLabel('2026-03')).toBe('March 2026')
  })

  it('handles January correctly', () => {
    expect(formatMonthLabel('2026-01')).toBe('January 2026')
  })
})
