/**
 * Classify the likely approach type based on weather conditions at landing
 * Uses FAR Part 91.175 and typical approach minimums
 */

export type ApproachSuggestion = {
  type: 'visual' | 'ILS' | 'RNAV' | 'RNP' | 'VOR' | 'LOC'
  confidence: 'high' | 'medium' | 'low'
  reason: string
  options: string[]   // all plausible options for quick select
}

/**
 * Suggest approach type based on ceiling (ft) and visibility (statute miles)
 * @param ceilingFt  Cloud ceiling in feet AGL (null = CAVU/clear)
 * @param visSm      Visibility in statute miles
 * @param airport    Destination ICAO (for future database lookup)
 */
export function classifyApproach(
  ceilingFt: number | null,
  visSm: number | null,
): ApproachSuggestion {
  const ceiling = ceilingFt ?? 99999
  const vis = visSm ?? 99

  // VMC — Visual Meteorological Conditions
  // FAR 91.157: ceiling >= 1000 AGL, vis >= 3sm for special VFR
  // Standard VFR: ceiling >= 3000, vis >= 5sm
  if (ceiling >= 3000 && vis >= 5) {
    return {
      type: 'visual',
      confidence: 'high',
      reason: `Ceiling ${ceiling === 99999 ? 'clear' : ceiling + 'ft'} / Vis ${vis}sm — VMC`,
      options: ['visual', 'RNAV', 'ILS'],
    }
  }

  // Marginal VMC — likely visual but instrument backup
  if (ceiling >= 1500 && vis >= 3) {
    return {
      type: 'visual',
      confidence: 'medium',
      reason: `Ceiling ${ceiling}ft / Vis ${vis}sm — Marginal VMC, visual probable`,
      options: ['visual', 'RNAV', 'ILS'],
    }
  }

  // RNAV (GPS) minimums typically 300-400ft / 1sm
  if (ceiling >= 400 && vis >= 1) {
    return {
      type: 'RNAV',
      confidence: 'medium',
      reason: `Ceiling ${ceiling}ft / Vis ${vis}sm — IMC, RNAV probable`,
      options: ['RNAV', 'ILS', 'RNP', 'VOR', 'LOC'],
    }
  }

  // ILS CAT I: 200ft DA / ½sm (2400 RVR)
  if (ceiling >= 200 && vis >= 0.5) {
    return {
      type: 'ILS',
      confidence: 'high',
      reason: `Ceiling ${ceiling}ft / Vis ${vis}sm — ILS CAT I conditions`,
      options: ['ILS', 'RNAV', 'RNP', 'LOC'],
    }
  }

  // ILS CAT II/III: < 200ft DA / < ½sm
  if (ceiling < 200 || vis < 0.5) {
    return {
      type: 'ILS',
      confidence: 'high',
      reason: `Ceiling ${ceiling}ft / Vis ${vis}sm — Low visibility, ILS CAT II/III probable`,
      options: ['ILS', 'RNP'],
    }
  }

  // Default fallback
  return {
    type: 'ILS',
    confidence: 'low',
    reason: 'Unable to classify — please select manually',
    options: ['visual', 'ILS', 'RNAV', 'RNP', 'VOR', 'LOC', 'NDB'],
  }
}
