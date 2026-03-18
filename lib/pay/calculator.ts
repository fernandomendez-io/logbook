/**
 * Pilot pay calculator
 * Based on standard regional airline CBA rules
 * Adapt guarantee, minimum per-day, and deadhead percentages to your specific CBA
 */

import type { Flight } from '@/lib/supabase/types'

export interface PayPeriodSummary {
  periodStart: string
  periodEnd: string

  // Scheduled credit
  scheduledBlockHrs: number

  // Actual flown
  actualBlockHrs: number

  // Credit = max(scheduled, actual) per flight
  creditHrs: number

  // Guarantee applied (if credit < guarantee)
  guaranteeHrs: number
  guaranteeApplied: number   // amount guarantee exceeded credit by

  // Deadhead credit (typically 50-100%)
  deadheadHrs: number

  // Misconnect credit (scheduled time of missed leg)
  misconnectHrs: number

  // Totals
  totalCreditHrs: number
  flightCount: number
  deadheadCount: number
  cancelledCount: number

  // Breakdown by type
  byType: Record<string, number>
}

// ─── CBA Constants — adjust to match your contract ───────────────────────────
const MONTHLY_GUARANTEE_HRS = 75       // typical regional guarantee
const DEADHEAD_CREDIT_PCT = 0.50       // 50% of block for deadhead
const MIN_DAILY_CREDIT_HRS = 4         // minimum credit per calendar day flown
const MISCONNECT_CREDIT_PCT = 1.00     // 100% of scheduled block of missed leg

/**
 * Calculate pay summary for a set of flights in a period
 */
export function calculatePayPeriod(
  flights: Flight[],
  periodStart: string,
  periodEnd: string,
  monthlyGuaranteeHrs: number = MONTHLY_GUARANTEE_HRS,
): PayPeriodSummary {
  let scheduledBlockHrs = 0
  let actualBlockHrs = 0
  let creditHrs = 0
  let deadheadHrs = 0
  let misconnectHrs = 0
  let flightCount = 0
  let deadheadCount = 0
  let cancelledCount = 0
  const byType: Record<string, number> = {}

  for (const flight of flights) {
    if (flight.is_cancelled) {
      cancelledCount++
      continue
    }

    const scheduled = flight.block_scheduled_hrs ?? 0
    const actual = flight.block_actual_hrs ?? 0

    if (flight.is_deadhead) {
      // Deadhead: credit at deadhead rate
      const dhCredit = scheduled * DEADHEAD_CREDIT_PCT
      deadheadHrs += dhCredit
      deadheadCount++
      byType['deadhead'] = (byType['deadhead'] || 0) + dhCredit
    } else {
      flightCount++
      scheduledBlockHrs += scheduled
      actualBlockHrs += actual

      // Credit = max(scheduled, actual) — "better of" rule
      const legCredit = Math.max(scheduled, actual)
      creditHrs += legCredit
      byType['block'] = (byType['block'] || 0) + legCredit
    }
  }

  // Total credit before guarantee
  const preGuaranteeCredit = creditHrs + deadheadHrs + misconnectHrs

  // Monthly guarantee
  let guaranteeApplied = 0
  if (preGuaranteeCredit < monthlyGuaranteeHrs) {
    guaranteeApplied = monthlyGuaranteeHrs - preGuaranteeCredit
  }

  const totalCreditHrs = preGuaranteeCredit + guaranteeApplied

  return {
    periodStart,
    periodEnd,
    scheduledBlockHrs: round(scheduledBlockHrs),
    actualBlockHrs: round(actualBlockHrs),
    creditHrs: round(creditHrs),
    guaranteeHrs: monthlyGuaranteeHrs,
    guaranteeApplied: round(guaranteeApplied),
    deadheadHrs: round(deadheadHrs),
    misconnectHrs: round(misconnectHrs),
    totalCreditHrs: round(totalCreditHrs),
    flightCount,
    deadheadCount,
    cancelledCount,
    byType,
  }
}

/**
 * Determine if a pilot has a misconnect on a given leg
 * A misconnect occurs when an inbound flight arrives too late
 * to make a scheduled outbound connection (typically <45 min connection time)
 */
export function detectMisconnect(
  inboundActualIn: Date,
  outboundScheduledOut: Date,
  minConnectionMin = 45,
): boolean {
  const connectionMin = (outboundScheduledOut.getTime() - inboundActualIn.getTime()) / 60000
  return connectionMin < minConnectionMin
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
