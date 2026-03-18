/**
 * Parses a raw METAR string into structured weather data
 * Sufficient for approach classification and logbook display
 */

export interface ParsedMETAR {
  station: string
  observationUtc: string     // ISO timestamp
  rawMetar: string
  windDir: number | null     // degrees true, null = variable
  windSpeedKt: number | null
  gustKt: number | null
  visibilitySm: number | null
  ceilingFt: number | null   // lowest BKN or OVC layer
  skyConditions: SkyCondition[]
  weather: string[]          // weather groups: -RA, TSRA, BR, FG, etc.
  tempC: number | null
  dewpointC: number | null
  altimeterInHg: number | null
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR'
}

export interface SkyCondition {
  coverage: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'CLR' | 'SKC' | 'VV'
  altitudeFt: number | null  // null for CLR/SKC
}

const COVERAGE_ORDER = ['FEW', 'SCT', 'BKN', 'OVC', 'VV']
const SIGNIFICANT = ['BKN', 'OVC', 'VV']

export function parseMetar(raw: string): ParsedMETAR {
  const tokens = raw.trim().split(/\s+/)
  let idx = 0

  let station = ''
  let observationUtc = ''
  let windDir: number | null = null
  let windSpeedKt: number | null = null
  let gustKt: number | null = null
  let visibilitySm: number | null = null
  const skyConditions: SkyCondition[] = []
  const weather: string[] = []
  let tempC: number | null = null
  let dewpointC: number | null = null
  let altimeterInHg: number | null = null

  // Skip "METAR" or "SPECI"
  if (tokens[idx] === 'METAR' || tokens[idx] === 'SPECI') idx++

  // Station ID
  station = tokens[idx++] || ''

  // Time: DDHHMMz
  const timeMatch = (tokens[idx] || '').match(/^(\d{2})(\d{2})(\d{2})Z$/)
  if (timeMatch) {
    idx++
    // We'll use the date from context; just parse HH:MM for now
    const now = new Date()
    const day = parseInt(timeMatch[1])
    const hour = parseInt(timeMatch[2])
    const min = parseInt(timeMatch[3])
    const obs = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day, hour, min))
    observationUtc = obs.toISOString()
  }

  // AUTO / COR
  if (tokens[idx] === 'AUTO' || tokens[idx] === 'COR') idx++

  // Wind: [VRB]dddssGggKT
  const windMatch = (tokens[idx] || '').match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT$/)
  if (windMatch) {
    idx++
    windDir = windMatch[1] === 'VRB' ? null : parseInt(windMatch[1])
    windSpeedKt = parseInt(windMatch[2])
    gustKt = windMatch[4] ? parseInt(windMatch[4]) : null
  }

  // Visibility
  // Could be "10SM", "1/4SM", "1 1/2SM"
  const visToken = tokens[idx] || ''
  if (visToken.endsWith('SM')) {
    idx++
    const visFrac = visToken.replace('SM', '')
    if (visFrac.includes('/')) {
      const parts = visFrac.split('/')
      visibilitySm = parseInt(parts[0]) / parseInt(parts[1])
    } else {
      visibilitySm = parseFloat(visFrac)
    }
  } else if (/^\d+$/.test(visToken) && (tokens[idx + 1] || '').endsWith('SM')) {
    // e.g. "1 1/2SM"
    const combined = visToken + tokens[idx + 1]
    idx += 2
    const parts = combined.replace('SM', '').split(' ')
    let total = parseInt(parts[0])
    if (parts[1] && parts[1].includes('/')) {
      const frac = parts[1].split('/')
      total += parseInt(frac[0]) / parseInt(frac[1])
    }
    visibilitySm = total
  }

  // Weather groups
  const WX_PATTERN = /^([-+]|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP)?(BR|FG|FU|VA|DU|SA|HZ|PY)?(PO|SQ|FC|SS|DS)?$/
  while (idx < tokens.length) {
    const t = tokens[idx]
    if (/^[A-Z+\-]{2,8}$/.test(t) && WX_PATTERN.test(t) && !t.match(/^\d/) && !t.match(/^(FEW|SCT|BKN|OVC|CLR|SKC|VV|M?\d)/)) {
      weather.push(t)
      idx++
    } else {
      break
    }
  }

  // Sky conditions: FEW020 SCT050 BKN080 OVC120 CLR SKC VV004
  const SKY = /^(FEW|SCT|BKN|OVC|CLR|SKC|VV)(\d{3})?(?:TCU|CB)?$/
  while (idx < tokens.length) {
    const skyMatch = tokens[idx].match(SKY)
    if (skyMatch) {
      skyConditions.push({
        coverage: skyMatch[1] as SkyCondition['coverage'],
        altitudeFt: skyMatch[2] ? parseInt(skyMatch[2]) * 100 : null,
      })
      idx++
    } else {
      break
    }
  }

  // Temp/Dewpoint: MM/MM or 10/07 or M02/M05
  const tdMatch = (tokens[idx] || '').match(/^(M?\d{1,2})\/(M?\d{1,2})$/)
  if (tdMatch) {
    idx++
    tempC = parseTemp(tdMatch[1])
    dewpointC = parseTemp(tdMatch[2])
  }

  // Altimeter: A2992 or Q1013
  const altMatch = (tokens[idx] || '').match(/^A(\d{4})$/)
  if (altMatch) {
    idx++
    altimeterInHg = parseInt(altMatch[1]) / 100
  }

  // ─── Ceiling ─────────────────────────────────────────────
  const significantLayers = skyConditions.filter(s => SIGNIFICANT.includes(s.coverage) && s.altitudeFt !== null)
  const ceilingFt = significantLayers.length > 0
    ? Math.min(...significantLayers.map(s => s.altitudeFt!))
    : null

  // ─── Flight category ──────────────────────────────────────
  const flightCategory = computeFlightCategory(ceilingFt, visibilitySm)

  return {
    station,
    observationUtc,
    rawMetar: raw,
    windDir,
    windSpeedKt,
    gustKt,
    visibilitySm,
    ceilingFt,
    skyConditions,
    weather,
    tempC,
    dewpointC,
    altimeterInHg,
    flightCategory,
  }
}

function parseTemp(s: string): number {
  return s.startsWith('M') ? -parseInt(s.slice(1)) : parseInt(s)
}

function computeFlightCategory(ceiling: number | null, vis: number | null): ParsedMETAR['flightCategory'] {
  const c = ceiling ?? 99999
  const v = vis ?? 99
  if (c < 500 || v < 1) return 'LIFR'
  if (c < 1000 || v < 3) return 'IFR'
  if (c < 3000 || v < 5) return 'MVFR'
  return 'VFR'
}
