/**
 * FAA medical certificate expiry calculation.
 * Rules per 14 CFR 61.23.
 */

export type MedicalClass = '1st' | '2nd' | '3rd'

/**
 * Calculate the expiry date of an FAA medical certificate.
 *
 * 1st class:
 *   - Age < 40 at exam: 12 calendar months
 *   - Age >= 40 at exam: 6 calendar months (for ATP/required 1st class ops)
 *   Note: 1st class also downgrades to 3rd class after 12 months (for private ops),
 *   but this function returns the 1st-class-privilege expiry.
 *
 * 2nd class: 12 calendar months
 *
 * 3rd class:
 *   - Age < 40 at exam: 60 calendar months
 *   - Age >= 40 at exam: 24 calendar months
 */
export function calculateMedicalExpiry(
  issuedDate: Date,
  certClass: MedicalClass,
  dateOfBirth: Date,
): Date {
  const ageAtExam = ageInYears(dateOfBirth, issuedDate)

  let months: number
  if (certClass === '1st') {
    months = ageAtExam < 40 ? 12 : 6
  } else if (certClass === '2nd') {
    months = 12
  } else {
    // 3rd class
    months = ageAtExam < 40 ? 60 : 24
  }

  // Expiry = end of the calendar month that is `months` months after issuance
  const expiry = new Date(issuedDate)
  expiry.setMonth(expiry.getMonth() + months)
  // Move to last day of that month (FAA: expires at end of month)
  expiry.setDate(1)
  expiry.setMonth(expiry.getMonth() + 1)
  expiry.setDate(0) // last day of previous month

  return expiry
}

function ageInYears(dob: Date, asOf: Date): number {
  const diff = asOf.getFullYear() - dob.getFullYear()
  const notYetBirthday =
    asOf.getMonth() < dob.getMonth() ||
    (asOf.getMonth() === dob.getMonth() && asOf.getDate() < dob.getDate())
  return notYetBirthday ? diff - 1 : diff
}

/** How many days until a given expiry date (negative = already expired) */
export function daysUntilExpiry(expiresDate: Date, asOf: Date = new Date()): number {
  const diffMs = expiresDate.getTime() - asOf.getTime()
  return Math.floor(diffMs / (24 * 3600 * 1000))
}

/** Color status based on days until expiry */
export function expiryStatus(days: number): 'ok' | 'warning' | 'danger' {
  if (days < 0) return 'danger'
  if (days < 30) return 'danger'
  if (days <= 60) return 'warning'
  return 'ok'
}

export const CERT_TYPES = [
  { value: 'medical_1st', label: '1st Class Medical' },
  { value: 'medical_2nd', label: '2nd Class Medical' },
  { value: 'medical_3rd', label: '3rd Class Medical' },
  { value: 'type_rating', label: 'Type Rating' },
  { value: 'bfr', label: 'Flight Review (BFR)' },
  { value: 'other', label: 'Other' },
] as const

export type CertType = typeof CERT_TYPES[number]['value']
