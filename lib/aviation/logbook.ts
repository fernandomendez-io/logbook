import type { Database } from '@/lib/supabase/types'

type Flight = Database['public']['Tables']['flights']['Row']

export interface LogbookTotals {
  // Counts
  totalFlights: number
  cancelledCount: number
  deadheadCount: number

  // Time
  totalBlockHrs: number
  totalFlightHrs: number
  totalNightHrs: number

  // By seat
  picBlockHrs: number
  sicBlockHrs: number

  // Approaches (non-visual, non-cancelled)
  totalApproaches: number
  approachesByType: Record<string, number>

  // Aircraft
  byAircraft: Record<string, number>

  // Deadhead
  deadheadHrs: number

  // Currency helpers — approaches
  last90DayApproaches: number
  last6MonthApproaches: number
  last28DayBlockHrs: number
  last365DayBlockHrs: number

  // 121.439 landing currency
  landingsLast90Days: number
  nightLandingsLast90Days: number
  landingCurrencyMet: boolean  // >= 3 day landings AND >= 1 night landing in 90 days
}

export function calculateLogbookTotals(
  flights: Flight[],
  pilotSeat: 'CA' | 'FO' | null = null,
  now: Date = new Date(),
): LogbookTotals {
  const nowMs = now.getTime()
  const ms90d = 90 * 24 * 3600 * 1000
  const ms6mo = 182 * 24 * 3600 * 1000
  const ms28d = 28 * 24 * 3600 * 1000
  const ms365d = 365 * 24 * 3600 * 1000

  let totalBlockHrs = 0
  let totalFlightHrs = 0
  let totalNightHrs = 0
  let picBlockHrs = 0
  let sicBlockHrs = 0
  let totalApproaches = 0
  let deadheadHrs = 0
  let last90DayApproaches = 0
  let last6MonthApproaches = 0
  let last28DayBlockHrs = 0
  let last365DayBlockHrs = 0
  let landingsLast90Days = 0
  let nightLandingsLast90Days = 0
  let cancelledCount = 0
  let deadheadCount = 0
  let totalFlights = 0
  const approachesByType: Record<string, number> = {}
  const byAircraft: Record<string, number> = {}

  for (const f of flights) {
    const flightDate = new Date(f.scheduled_out_utc).getTime()
    const ageMs = nowMs - flightDate
    const blockHrs = f.block_actual_hrs ?? f.block_scheduled_hrs ?? 0

    if (f.is_cancelled) {
      cancelledCount++
      continue
    }

    if (f.is_deadhead) {
      deadheadCount++
      deadheadHrs += blockHrs
      // Deadheads still count toward block time accumulators
      if (ageMs <= ms28d) last28DayBlockHrs += blockHrs
      if (ageMs <= ms365d) last365DayBlockHrs += blockHrs
      continue
    }

    totalFlights++
    totalBlockHrs += blockHrs
    totalFlightHrs += f.flight_time_hrs ?? 0
    totalNightHrs += f.night_time_hrs ?? 0

    if (f.pilot_flying === 'CA') picBlockHrs += blockHrs
    else if (f.pilot_flying === 'FO') sicBlockHrs += blockHrs

    if (f.aircraft_type) {
      byAircraft[f.aircraft_type] = (byAircraft[f.aircraft_type] ?? 0) + blockHrs
    }

    if (ageMs <= ms28d) last28DayBlockHrs += blockHrs
    if (ageMs <= ms365d) last365DayBlockHrs += blockHrs

    if (f.approach_type && f.approach_type !== 'visual') {
      totalApproaches++
      approachesByType[f.approach_type] = (approachesByType[f.approach_type] ?? 0) + 1

      if (ageMs <= ms90d) last90DayApproaches++
      if (ageMs <= ms6mo) last6MonthApproaches++
    }

    // 121.439 landing currency: count when this pilot was the landing pilot
    if (ageMs <= ms90d && pilotSeat && f.landing_pilot === pilotSeat) {
      landingsLast90Days++
      if ((f.night_time_hrs ?? 0) > 0) {
        nightLandingsLast90Days++
      }
    }
  }

  const landingCurrencyMet = landingsLast90Days >= 3 && nightLandingsLast90Days >= 1

  return {
    totalFlights,
    cancelledCount,
    deadheadCount,
    totalBlockHrs,
    totalFlightHrs,
    totalNightHrs,
    picBlockHrs,
    sicBlockHrs,
    totalApproaches,
    approachesByType,
    byAircraft,
    deadheadHrs,
    last90DayApproaches,
    last6MonthApproaches,
    last28DayBlockHrs,
    last365DayBlockHrs,
    landingsLast90Days,
    nightLandingsLast90Days,
    landingCurrencyMet,
  }
}
