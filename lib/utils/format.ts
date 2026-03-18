import { format, formatDuration, intervalToDuration } from 'date-fns'

export function formatHHMM(date: Date | string): string {
  return format(new Date(date), 'HHmm')
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateShort(date: Date | string): string {
  return format(new Date(date), 'ddMMM').toUpperCase()
}

export function decimalToHHMM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function minutesToDecimal(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function blockHours(outTime: Date | string, inTime: Date | string): number {
  const diff = new Date(inTime).getTime() - new Date(outTime).getTime()
  return Math.round((diff / 3600000) * 100) / 100
}

export function flightHours(offTime: Date | string, onTime: Date | string): number {
  const diff = new Date(onTime).getTime() - new Date(offTime).getTime()
  return Math.round((diff / 3600000) * 100) / 100
}

export function formatDurationHM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function localToUTC(localStr: string, timezone: string): string {
  // localStr: "HHMM" on a given date — handled by caller passing full ISO
  return localStr
}
