/** Returns the browser's IANA timezone string, e.g. "America/Chicago" */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Returns the short timezone abbreviation for display, e.g. "CDT", "EST" */
export function getTimezoneAbbr(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? 'LT'
  } catch {
    return 'LT'
  }
}

/**
 * Converts a UTC datetime string "YYYY-MM-DDTHH:MM" to the local equivalent
 * in the given IANA timezone. Returns "" on invalid input.
 */
export function utcDtToLocal(utcDT: string, tz: string): string {
  if (!utcDT || utcDT.length < 16 || !utcDT.includes('T')) return ''
  const date = new Date(utcDT + ':00Z')
  if (isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour') // midnight guard
  const year = get('year'), month = get('month'), day = get('day'), min = get('minute')

  if (!year || !month || !day || !hour || !min) return ''
  return `${year}-${month}-${day}T${hour}:${min}`
}

/**
 * Converts a local datetime string "YYYY-MM-DDTHH:MM" (in the given IANA timezone)
 * back to "YYYY-MM-DDTHH:MM" UTC. Uses the classic offset trick — accurate across
 * standard/DST transitions. Returns "" on invalid input.
 */
export function localDtToUtc(localDT: string, tz: string): string {
  if (!localDT || localDT.length < 16 || !localDT.includes('T')) return ''

  // Step 1: parse local as if it were UTC (naive)
  const naive = new Date(localDT + ':00Z')
  if (isNaN(naive.getTime())) return ''

  // Step 2: ask Intl what that UTC instant looks like in the target timezone
  const shown = utcDtToLocal(localDT, tz)
  if (!shown) return ''

  // Step 3: parse that shown local as another naive UTC
  const shownMs = new Date(shown + ':00Z').getTime()

  // Step 4: compute offset and correct
  const offsetMs = naive.getTime() - shownMs
  const utcDate = new Date(naive.getTime() + offsetMs)

  return utcDate.toISOString().slice(0, 16)
}
