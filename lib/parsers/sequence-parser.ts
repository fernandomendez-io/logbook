/**
 * Crew schedule sequence parser — HSS (Historical Schedule Sheet) format
 *
 * Handles the paired SKD/ACT row format used by Mesa Air and similar regional
 * carriers. Each flight leg has a scheduled (SKD) and actual (ACT) row.
 *
 * Equipment codes:
 *   54 / 0F / 1A = regional (E170/E175)
 *   99            = AA mainline (deadhead)
 *   XX            = positioning / cancelled day
 *
 * Flags (trailing on flight lines):
 *   STUB  = credited at scheduled even though actual was less
 *   DVTD  = diverted to alternate airport
 *   RTD   = returned to departure (RTG)
 *   AA    = American Airlines mainline segment (suffix on FLY time, e.g. 2.55AA)
 *   SO    = sign-off marker (administrative, not a real flight)
 *   D     = deadhead credit (suffix on P/C amount in D/P summary line)
 */

export interface ParsedFlight {
  line: number
  flightNumber: string        // raw flight number, e.g. "3779"
  originIcao: string          // IATA airport
  destinationIcao: string
  scheduledOut: string        // "HHMM" local
  scheduledIn: string         // "HHMM" local
  actualOut?: string          // "HHMM" local (from ACT row)
  actualIn?: string           // "HHMM" local
  date: string                // "YYYY-MM-DD" of scheduled departure
  scheduledBlockHrs?: number  // FLY column from SKD row (decimal hours)
  actualBlockHrs?: number     // FLY column from ACT row
  guaranteeBlockHrs?: number  // GTR column (max of skd/act)
  aircraftType?: 'E170' | 'E175'
  tailNumber?: string
  equipmentCode?: string      // raw EQ field
  isDeadhead: boolean         // EQ=99, XX, or AA-suffix
  isPositioning: boolean      // EQ=XX
  isCancelled: boolean        // RTD or dest=****
  isDiverted: boolean         // DVTD flag
  isReturnedToGate: boolean   // RTD flag
  isStub: boolean             // STUB flag
}

export interface ParsedEvent {
  type: 'return_to_gate' | 'diversion' | 'change' | 'reassignment' | 'cancellation' | 'delay'
  description: string
  originalFlightNumber?: string
  newFlightNumber?: string
  reason?: string
}

export interface ParsedDutyPeriod {
  reportTime: string          // "HHMM"
  releaseTime: string         // "HHMM"
  reportDate: string          // "YYYY-MM-DD"
  flights: ParsedFlight[]
  guaranteeHrs?: number
  scheduledOnDutyHrs?: number
  actualOnDutyHrs?: number
}

export interface ParsedSequence {
  sequenceNumber: string
  domicile: string
  equipmentType?: string      // e.g. "E75"
  captainName?: string
  captainEmpNum?: string
  foName?: string
  foEmpNum?: string
  reportDate: string          // first day "YYYY-MM-DD"
  releaseDate: string         // last day "YYYY-MM-DD"
  tafbHrs?: number
  sequenceCreditHrs?: number
  dutyPeriods: ParsedDutyPeriod[]
  allFlights: ParsedFlight[]
  events: ParsedEvent[]
  rawText: string
  warnings: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse H.MM format (hours.minutes, NOT decimal) → decimal hours */
function parseHMM(val: string): number {
  const clean = val.replace(/[A-Za-z]+$/, '')
  const dot = clean.indexOf('.')
  if (dot === -1) return parseInt(clean) || 0
  const h = parseInt(clean.slice(0, dot)) || 0
  const mStr = clean.slice(dot + 1).padEnd(2, '0').slice(0, 2)
  return h + parseInt(mStr) / 60
}

function buildDate(yearMonth: string, day: number): string {
  return `${yearMonth}-${String(day).padStart(2, '0')}`
}

/** Advance yearMonth by one month */
function nextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, '0')}`
}

// ─── Internal row type ────────────────────────────────────────────────────────

interface HSSRow {
  kind: 'SKD' | 'ACT'
  day: number
  eq: string
  flightNum: string
  origin: string
  dep: string         // HHMM
  dest: string        // may be '****'
  arr: string         // HHMM or '****'
  flyHrs?: number
  gtrHrs?: number
  flags: string[]
}

const FLAG_WORDS = new Set(['STUB', 'DVTD', 'RTD', 'CXLD', 'CXL'])

function parseFlightLineRest(rest: string): Pick<HSSRow, 'flyHrs' | 'gtrHrs' | 'flags'> {
  const tokens = rest.trim().split(/\s+/).filter(Boolean)
  const flags: string[] = []
  const times: number[] = []

  for (const tok of tokens) {
    const upper = tok.toUpperCase()

    // Explicit flag words
    if (FLAG_WORDS.has(upper)) { flags.push(upper); continue }

    // Time token: digits.digits with optional trailing letters (e.g. "2.55AA", "0.00SO")
    const m = tok.match(/^(\d+\.\d+)([A-Za-z]*)$/)
    if (m) {
      times.push(parseHMM(m[1]))
      if (m[2]) flags.push(m[2].toUpperCase())
      continue
    }

    // Short 1–2 digit numbers (AC seat config, e.g. "25") — skip
    if (/^\d{1,2}$/.test(tok)) continue

    // Remaining uppercase tokens that aren't stop words
    const stopWords = new Set(['ACC', 'STA', 'DFW', 'ORD', 'ATL']) // avoid mistaking airports
    if (/^[A-Z]{1,6}$/.test(upper) && !stopWords.has(upper)) {
      flags.push(upper)
    }
  }

  return { flyHrs: times[0], gtrHrs: times[1], flags }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Parse an HSS-format crew sequence.
 *
 * @param raw        Pasted text from HSS printout / PDF copy
 * @param yearMonth  "YYYY-MM" for the month the sequence operates in.
 *                   Defaults to current month. Required because HSS only
 *                   shows day-of-month numbers (e.g. 15, 16, 17).
 */
export function parseSequence(raw: string, yearMonth?: string): ParsedSequence {
  if (!yearMonth) {
    const now = new Date()
    yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const warnings: string[] = []
  const events: ParsedEvent[] = []
  const dutyPeriods: ParsedDutyPeriod[] = []

  // Sequence-level fields
  let sequenceNumber = ''
  let domicile = ''
  let equipmentType = ''
  let captainName: string | undefined
  let captainEmpNum: string | undefined
  let foName: string | undefined
  let foEmpNum: string | undefined
  let tafbHrs: number | undefined
  let seqCreditHrs: number | undefined

  // Duty-period accumulator
  let dpRows: HSSRow[] = []
  let dpGtrHrs: number | undefined
  let dpStartTime = ''
  let dpEndTime = ''
  let dpOnDutySkd: number | undefined
  let dpOnDutyAct: number | undefined
  let state: 'idle' | 'flights' | 'summary' = 'idle'

  // Track month context (sequences can span month boundaries)
  let activeMon = yearMonth
  let lastDay = 0

  // ── Regex patterns ────────────────────────────────────────────────────────
  const RE_SEQ    = /^SEQ\s+(\d+)\s+BASE\s+([A-Z]+)\s+SEL\s+\d+\s+DOM\s+([A-Z0-9]+)/i
  const RE_CAPT   = /^CAPT\s+(.+?)\s+EMP\s+NBR\s+(\d+)\s*$/i
  const RE_FO     = /^F\/O\s+(.+?)\s+EMP\s+NBR\s+(\d+)\s*$/i
  const RE_FLIGHT = /^(SKD|ACT)\s+(\d{1,2})\s+(\S+)\s+(\d{3,4})\s+([A-Z]{3,4})\s+(\d{4})\s+([A-Z*]{3,4})\s+(\d{4}|\*{4})\s*(.*)/i
  const RE_DP     = /^D\/P\s+(?:GTR|SKD)\s+([\d.]+)/i   // GTR=past, SKD=future
  const RE_FDPT   = /FDPT\s+[\d.]+\s+START\s+(\d{4})\s+END\s+(\d{4})/i
  const RE_SKDOD  = /^SKD\s+ONDUTY\s+([\d.]+)/i
  const RE_ACTOD  = /^ACT\s+ONDUTY\s+([\d.]+)/i
  const RE_SEQTOT = /^SEQ\s+(?:GTR|SKD)\s+([\d.]+).*?TAFB\s+([\d.]+)/i

  // ── Finalize a duty period ────────────────────────────────────────────────
  function finalizeDP() {
    if (dpRows.length === 0) return

    const skdRows = dpRows.filter(r => r.kind === 'SKD' && !r.flags.includes('SO'))
    const actRows = dpRows.filter(r => r.kind === 'ACT' && !r.flags.includes('SO'))

    // Determine aircraft type from sequence header
    let acType: 'E170' | 'E175' | undefined
    const eq = equipmentType.toUpperCase()
    if (eq.includes('E75') || eq.includes('175')) acType = 'E175'
    if (eq.includes('E70') || eq.includes('170')) acType = 'E170'

    const flights: ParsedFlight[] = []
    for (const skd of skdRows) {
      // Find matching ACT row (same day, flight number, and origin)
      const act = actRows.find(a =>
        a.day === skd.day &&
        a.flightNum === skd.flightNum &&
        a.origin === skd.origin
      )

      const isAA = skd.flags.includes('AA') || (act?.flags.includes('AA') ?? false)
      const isDH = skd.eq === '99' || skd.eq === 'XX' || isAA
      const isPos = skd.eq === 'XX'
      const isRTD = (act?.flags.includes('RTD') ?? false) || skd.flags.includes('RTD')
      const isDvtd = act?.flags.includes('DVTD') ?? false
      const isStub = act?.flags.includes('STUB') ?? false
      const isCxl = skd.dest === '****' || skd.arr === '****' || isRTD

      // Handle month rollover within a duty period
      let dayMon = activeMon
      if (skd.day < lastDay && lastDay > 0) dayMon = nextMonth(dayMon)

      const destFinal = skd.dest === '****' ? skd.origin : skd.dest

      flights.push({
        line: 0,
        flightNumber: skd.flightNum,
        originIcao: skd.origin,
        destinationIcao: destFinal,
        scheduledOut: skd.dep,
        scheduledIn: skd.arr === '****' ? '0000' : skd.arr,
        actualOut: act?.dep,
        actualIn: (act?.arr && act.arr !== '****') ? act.arr : undefined,
        date: buildDate(dayMon, skd.day),
        scheduledBlockHrs: skd.flyHrs,
        actualBlockHrs: act?.flyHrs,
        guaranteeBlockHrs: act?.gtrHrs ?? skd.flyHrs,
        aircraftType: acType,
        equipmentCode: skd.eq,
        isDeadhead: isDH,
        isPositioning: isPos,
        isCancelled: isCxl,
        isDiverted: isDvtd,
        isReturnedToGate: isRTD,
        isStub,
      })

      if (isDvtd) {
        events.push({
          type: 'diversion',
          description: `Flight ${skd.flightNum} diverted ${skd.origin}→${act?.dest ?? '?'}`,
          originalFlightNumber: skd.flightNum,
        })
      }
      if (isRTD) {
        events.push({
          type: 'return_to_gate',
          description: `Flight ${skd.flightNum} returned to gate at ${skd.origin}`,
          originalFlightNumber: skd.flightNum,
        })
      }
    }

    const minDay = Math.min(...dpRows.map(r => r.day))
    dutyPeriods.push({
      reportTime: dpStartTime || '0000',
      releaseTime: dpEndTime || '0000',
      reportDate: buildDate(activeMon, minDay),
      flights,
      guaranteeHrs: dpGtrHrs,
      scheduledOnDutyHrs: dpOnDutySkd,
      actualOnDutyHrs: dpOnDutyAct,
    })

    // Reset accumulator
    dpRows = []
    dpGtrHrs = undefined
    dpStartTime = ''
    dpEndTime = ''
    dpOnDutySkd = undefined
    dpOnDutyAct = undefined
  }

  // ── Line-by-line parsing ──────────────────────────────────────────────────
  for (const line of lines) {
    // Sequence header
    if (!sequenceNumber) {
      const m = line.match(RE_SEQ)
      if (m) { sequenceNumber = m[1]; domicile = m[2]; equipmentType = m[3]; continue }
    }

    // Crew lines
    if (!captainName) {
      const m = line.match(RE_CAPT)
      if (m) { captainName = m[1].trim(); captainEmpNum = m[2]; continue }
    }
    if (!foName) {
      const m = line.match(RE_FO)
      if (m) { foName = m[1].trim(); foEmpNum = m[2]; continue }
    }

    // Sequence totals (last line of HSS)
    const seqTot = line.match(RE_SEQTOT)
    if (seqTot) {
      seqCreditHrs = parseHMM(seqTot[1])
      tafbHrs = parseHMM(seqTot[2])
      if (state !== 'idle') finalizeDP()
      continue
    }

    // Flight line
    const fm = line.match(RE_FLIGHT)
    if (fm) {
      const kind = fm[1].toUpperCase() as 'SKD' | 'ACT'
      const day = parseInt(fm[2])

      // Detect month rollover (day resets, e.g. 31 → 1)
      if (day < lastDay && lastDay > 20 && day < 10) {
        activeMon = nextMonth(activeMon)
      }
      lastDay = day

      const { flyHrs, gtrHrs, flags } = parseFlightLineRest(fm[9])
      if (state === 'idle') state = 'flights'

      dpRows.push({
        kind, day,
        eq: fm[3],
        flightNum: fm[4],
        origin: fm[5],
        dep: fm[6],
        dest: fm[7],
        arr: fm[8],
        flyHrs, gtrHrs, flags,
      })
      continue
    }

    // D/P summary line (end of flight rows for this DP)
    const dpM = line.match(RE_DP)
    if (dpM && state === 'flights') {
      dpGtrHrs = parseHMM(dpM[1])
      state = 'summary'
      continue
    }

    // On-duty times (in summary block)
    if (state === 'summary') {
      const skdOD = line.match(RE_SKDOD)
      if (skdOD) { dpOnDutySkd = parseHMM(skdOD[1]); continue }

      const actOD = line.match(RE_ACTOD)
      if (actOD) { dpOnDutyAct = parseHMM(actOD[1]); continue }

      // FDPT line = end of this duty period's summary
      const fdpt = line.match(RE_FDPT)
      if (fdpt) {
        dpStartTime = fdpt[1]
        dpEndTime = fdpt[2]
        finalizeDP()
        state = 'idle'
        continue
      }
    }
  }

  // Close any trailing duty period (shouldn't happen if FDPT is always present)
  if (state !== 'idle') {
    warnings.push('Last duty period may be incomplete — FDPT/START/END line not found.')
    finalizeDP()
  }

  if (!sequenceNumber) {
    warnings.push('Could not detect sequence header. Ensure the text starts with "SEQ NNNN BASE XXX SEL NNN DOM E75".')
  }

  const allFlights = dutyPeriods.flatMap(dp => dp.flights)
  const reportDate = dutyPeriods[0]?.reportDate || yearMonth + '-01'
  const releaseDate = dutyPeriods[dutyPeriods.length - 1]?.reportDate || reportDate

  return {
    sequenceNumber,
    domicile,
    equipmentType,
    captainName,
    captainEmpNum,
    foName,
    foEmpNum,
    reportDate,
    releaseDate,
    tafbHrs,
    sequenceCreditHrs: seqCreditHrs,
    dutyPeriods,
    allFlights,
    events,
    rawText: raw,
    warnings,
  }
}
