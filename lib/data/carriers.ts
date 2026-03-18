/**
 * US airline carriers and their regionals.
 * `displayPrefix` — the carrier's own IATA code, used in logbook display and storage (e.g. MQ4174)
 * `searchPrefix`  — code used for AeroDataBox lookups; regionals fly under mainline numbers (e.g. AA4174)
 */
export interface Carrier {
  value: string          // unique key stored in profiles.operating_carrier
  label: string          // display label
  iata: string           // the operating carrier's own IATA code
  displayPrefix: string  // prefix shown in logbook (own IATA: MQ, OO, YV, …)
  searchPrefix: string   // prefix for AeroDataBox API calls (mainline: AA, UA, DL, …)
  mainline: string       // mainline partner IATA (same as iata for mainlines)
  /** @deprecated use displayPrefix */
  flightPrefix: string
}

export const CARRIERS: Carrier[] = [
  // ── American Airlines ──────────────────────────────────────────────────────
  { value: 'AA',    label: 'American Airlines',                        iata: 'AA', displayPrefix: 'AA', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'AA' },
  { value: 'MQ_AA', label: 'American Eagle – Envoy Air (MQ)',          iata: 'MQ', displayPrefix: 'MQ', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'MQ' },
  { value: 'YV_AA', label: 'American Eagle – Mesa Air (YV)',           iata: 'YV', displayPrefix: 'YV', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'YV' },
  { value: 'OO_AA', label: 'American Eagle – SkyWest (OO/AA)',         iata: 'OO', displayPrefix: 'OO', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'OO' },
  { value: 'PT_AA', label: 'American Eagle – Piedmont Airlines (PT)',  iata: 'PT', displayPrefix: 'PT', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'PT' },
  { value: 'OH_AA', label: 'American Eagle – PSA Airlines (OH)',       iata: 'OH', displayPrefix: 'OH', searchPrefix: 'AA', mainline: 'AA', flightPrefix: 'OH' },

  // ── United Airlines ────────────────────────────────────────────────────────
  { value: 'UA',    label: 'United Airlines',                          iata: 'UA', displayPrefix: 'UA', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'UA' },
  { value: 'OO_UA', label: 'United Express – SkyWest (OO/UA)',         iata: 'OO', displayPrefix: 'OO', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'OO' },
  { value: 'G7_UA', label: 'United Express – GoJet Airlines (G7)',     iata: 'G7', displayPrefix: 'G7', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'G7' },
  { value: 'ZW_UA', label: 'United Express – Air Wisconsin (ZW)',      iata: 'ZW', displayPrefix: 'ZW', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'ZW' },
  { value: 'YV_UA', label: 'United Express – Mesa Air (YV/UA)',        iata: 'YV', displayPrefix: 'YV', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'YV' },
  { value: 'C5_UA', label: 'United Express – CommutAir (C5)',          iata: 'C5', displayPrefix: 'C5', searchPrefix: 'UA', mainline: 'UA', flightPrefix: 'C5' },

  // ── Delta Air Lines ────────────────────────────────────────────────────────
  { value: 'DL',    label: 'Delta Air Lines',                          iata: 'DL', displayPrefix: 'DL', searchPrefix: 'DL', mainline: 'DL', flightPrefix: 'DL' },
  { value: '9E_DL', label: 'Delta Connection – Endeavor Air (9E)',     iata: '9E', displayPrefix: '9E', searchPrefix: 'DL', mainline: 'DL', flightPrefix: '9E' },
  { value: 'OO_DL', label: 'Delta Connection – SkyWest (OO/DL)',       iata: 'OO', displayPrefix: 'OO', searchPrefix: 'DL', mainline: 'DL', flightPrefix: 'OO' },
  { value: 'YX_DL', label: 'Delta Connection – Republic Airways (YX)', iata: 'YX', displayPrefix: 'YX', searchPrefix: 'DL', mainline: 'DL', flightPrefix: 'YX' },

  // ── Alaska Airlines ────────────────────────────────────────────────────────
  { value: 'AS',    label: 'Alaska Airlines',                          iata: 'AS', displayPrefix: 'AS', searchPrefix: 'AS', mainline: 'AS', flightPrefix: 'AS' },
  { value: 'QX_AS', label: 'Alaska / Horizon Air (QX)',                iata: 'QX', displayPrefix: 'QX', searchPrefix: 'AS', mainline: 'AS', flightPrefix: 'QX' },
  { value: 'OO_AS', label: 'Alaska / SkyWest (OO/AS)',                 iata: 'OO', displayPrefix: 'OO', searchPrefix: 'AS', mainline: 'AS', flightPrefix: 'OO' },

  // ── Others ─────────────────────────────────────────────────────────────────
  { value: 'WN', label: 'Southwest Airlines',  iata: 'WN', displayPrefix: 'WN', searchPrefix: 'WN', mainline: 'WN', flightPrefix: 'WN' },
  { value: 'B6', label: 'JetBlue Airways',     iata: 'B6', displayPrefix: 'B6', searchPrefix: 'B6', mainline: 'B6', flightPrefix: 'B6' },
  { value: 'F9', label: 'Frontier Airlines',   iata: 'F9', displayPrefix: 'F9', searchPrefix: 'F9', mainline: 'F9', flightPrefix: 'F9' },
  { value: 'NK', label: 'Spirit Airlines',     iata: 'NK', displayPrefix: 'NK', searchPrefix: 'NK', mainline: 'NK', flightPrefix: 'NK' },
  { value: 'G4', label: 'Allegiant Air',       iata: 'G4', displayPrefix: 'G4', searchPrefix: 'G4', mainline: 'G4', flightPrefix: 'G4' },
  { value: 'SY', label: 'Sun Country Airlines',iata: 'SY', displayPrefix: 'SY', searchPrefix: 'SY', mainline: 'SY', flightPrefix: 'SY' },
  { value: 'HA', label: 'Hawaiian Airlines',   iata: 'HA', displayPrefix: 'HA', searchPrefix: 'HA', mainline: 'HA', flightPrefix: 'HA' },
]

/** Returns the display prefix (own IATA) for a carrier */
export function getDisplayPrefix(operatingCarrier?: string | null): string | null {
  if (!operatingCarrier) return null
  return CARRIERS.find(c => c.value === operatingCarrier)?.displayPrefix ?? null
}

/** Returns the search prefix (mainline IATA) for AeroDataBox lookups */
export function getSearchPrefix(operatingCarrier?: string | null): string | null {
  if (!operatingCarrier) return null
  return CARRIERS.find(c => c.value === operatingCarrier)?.searchPrefix ?? null
}

/** @deprecated use getDisplayPrefix */
export function getFlightPrefix(operatingCarrier?: string | null): string | null {
  return getDisplayPrefix(operatingCarrier)
}

/** Add display prefix to a bare flight number for logbook storage (e.g. "4174" → "MQ4174") */
export function prefixFlight(flightNumber: string, operatingCarrier?: string | null): string {
  const prefix = getDisplayPrefix(operatingCarrier)
  if (!prefix) return flightNumber
  if (/^[A-Z0-9]{2}\d/i.test(flightNumber)) return flightNumber
  return `${prefix}${flightNumber}`
}

/** Add display prefix to a bare flight number for FR24 searches (e.g. "4174" → "MQ4174").
 *  FR24 indexes flights under the operating carrier (MQ), not the mainline (AA).
 *  @deprecated searchPrefix (mainline) was for AeroDataBox — FR24 uses displayPrefix. */
export function prefixFlightForSearch(flightNumber: string, operatingCarrier?: string | null): string {
  const prefix = getDisplayPrefix(operatingCarrier)
  if (!prefix) return flightNumber
  let bare = flightNumber
  if (bare.toUpperCase().startsWith(prefix.toUpperCase())) {
    bare = bare.slice(prefix.length)
  }
  if (/^[A-Z]{2}\d/i.test(bare)) return bare  // already has a letter prefix
  return `${prefix}${bare}`
}
