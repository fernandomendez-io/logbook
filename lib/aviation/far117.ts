/**
 * FAR Part 117 — Flightcrew Member Duty and Rest Requirements
 * For Part 121 operations (scheduled air carriers)
 */

export interface FAR117Status {
  flightTime28dHrs: number
  flightTime28dLimit: number     // 100
  flightTime28dPct: number
  flightTime365dHrs: number
  flightTime365dLimit: number    // 1000
  flightTime365dPct: number
  dutyTime7dHrs: number
  nextDutyEarliestStart: Date | null
  maxFlightTimeNextDutyHrs: number
  restRequiredHrs: number
  isCompliant: boolean
  violations: string[]
  warnings: string[]             // approaching limits (>85% used)
}

export interface DutyPeriodInfo {
  startUtc: Date
  endUtc: Date | null
  flightSegments: number
  isAugmented: boolean
  acclimated: boolean
}

// ─── FAR 117 Table B — Max flight time by # of segments (non-augmented, acclimated)
// Rows: [1 seg, 2 segs, 3 segs, 4+ segs]
// Based on whether any flight occurs during WOCL (0200-0559 local)
const FLIGHT_TIME_LIMITS_WOCL: Record<number, number> = {
  1: 9.0, 2: 9.0, 3: 8.0, 4: 8.0,
}
const FLIGHT_TIME_LIMITS_NO_WOCL: Record<number, number> = {
  1: 9.0, 2: 9.0, 3: 9.0, 4: 9.0,
}

/**
 * Compute max allowable flight time for a duty period
 * For simplicity, using the most common case (acclimated, no WOCL)
 * Detailed WOCL calculation requires departure local time
 */
export function maxFlightTimeDutyPeriod(segments: number, woclDeparture = false): number {
  const limits = woclDeparture ? FLIGHT_TIME_LIMITS_WOCL : FLIGHT_TIME_LIMITS_NO_WOCL
  const key = Math.min(segments, 4)
  return limits[key] ?? 8.0
}

// ─── FAR 117.23 — Minimum rest
export const MIN_REST_HOURS = 10       // consecutive hours before any duty period
export const MIN_REST_OPPORTUNITY = 10  // hours of rest opportunity at layover

// ─── FAR 117.11 — Flight time limits
export const LIMIT_28D = 100
export const LIMIT_365D = 1000

/**
 * Build FAR 117 status object from accumulated values
 */
export function buildFAR117Status(params: {
  flightTime28dHrs: number
  flightTime365dHrs: number
  dutyTime7dHrs: number
  lastDutyEndUtc: Date | null
  nextDutySegments?: number
}): FAR117Status {
  const { flightTime28dHrs, flightTime365dHrs, dutyTime7dHrs, lastDutyEndUtc, nextDutySegments = 2 } = params

  const violations: string[] = []
  const warnings: string[] = []

  // Compute percentages
  const pct28d = (flightTime28dHrs / LIMIT_28D) * 100
  const pct365d = (flightTime365dHrs / LIMIT_365D) * 100

  // Violations
  if (flightTime28dHrs > LIMIT_28D) violations.push(`28-day flight time limit exceeded: ${flightTime28dHrs.toFixed(1)} / ${LIMIT_28D} hrs`)
  if (flightTime365dHrs > LIMIT_365D) violations.push(`365-day flight time limit exceeded: ${flightTime365dHrs.toFixed(1)} / ${LIMIT_365D} hrs`)

  // Warnings (>85% of limit)
  if (pct28d >= 85 && pct28d <= 100) warnings.push(`28-day flight time at ${pct28d.toFixed(0)}% of limit (${flightTime28dHrs.toFixed(1)}/${LIMIT_28D} hrs)`)
  if (pct365d >= 85 && pct365d <= 100) warnings.push(`365-day flight time at ${pct365d.toFixed(0)}% of limit (${flightTime365dHrs.toFixed(1)}/${LIMIT_365D} hrs)`)

  // Next duty earliest start (10 hrs after last release)
  let nextDutyEarliestStart: Date | null = null
  if (lastDutyEndUtc) {
    nextDutyEarliestStart = new Date(lastDutyEndUtc.getTime() + MIN_REST_HOURS * 3600000)
  }

  const maxFlightTimeNextDutyHrs = maxFlightTimeDutyPeriod(nextDutySegments)

  return {
    flightTime28dHrs,
    flightTime28dLimit: LIMIT_28D,
    flightTime28dPct: pct28d,
    flightTime365dHrs,
    flightTime365dLimit: LIMIT_365D,
    flightTime365dPct: pct365d,
    dutyTime7dHrs,
    nextDutyEarliestStart,
    maxFlightTimeNextDutyHrs,
    restRequiredHrs: MIN_REST_HOURS,
    isCompliant: violations.length === 0,
    violations,
    warnings,
  }
}

/**
 * Compute rest between two duty periods
 */
export function computeRest(prevReleaseUtc: Date, nextReportUtc: Date): number {
  return (nextReportUtc.getTime() - prevReleaseUtc.getTime()) / 3600000
}

/**
 * Check if a rest period meets the minimum requirement
 */
export function meetsMinimumRest(restHours: number): boolean {
  return restHours >= MIN_REST_HOURS
}
