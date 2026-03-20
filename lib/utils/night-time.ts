/**
 * Night time calculation using solar position.
 * No external dependencies — pure spherical astronomy.
 *
 * Night = solar elevation < -0.833° (standard sunrise/sunset threshold,
 * accounts for atmospheric refraction and solar disk radius).
 */

export interface FlightPoint {
  lat: number
  lon: number
  timestamp: string
}

/**
 * Solar elevation in degrees at a given lat/lon/time.
 * Based on the low-precision solar position algorithm (accuracy ~1°).
 */
function getSolarElevationDeg(lat: number, lon: number, date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5   // Julian Day
  const n  = jd - 2451545.0                           // days since J2000.0

  const deg = Math.PI / 180

  // Mean longitude and mean anomaly (degrees)
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360
  const gDeg = ((357.528 + 0.9856003 * n) % 360 + 360) % 360
  const g = gDeg * deg

  // Ecliptic longitude (degrees → radians)
  const lambdaDeg = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)
  const lambda = lambdaDeg * deg

  // Obliquity of ecliptic
  const eps = (23.439 - 0.0000004 * n) * deg

  // Sun's declination
  const sinDec = Math.sin(eps) * Math.sin(lambda)
  const dec    = Math.asin(sinDec)

  // Right ascension (radians)
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda))

  // Greenwich Mean Sidereal Time (hours)
  const ut   = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const gmst = ((6.697375 + 0.0657098242 * n + ut) % 24 + 24) % 24

  // Local hour angle (radians)
  const lmst = (gmst + lon / 15 + 24) % 24
  const H    = ((lmst * 15 - ra / deg + 360) % 360) * deg

  // Solar elevation
  const latRad = lat * deg
  const sinAlt = Math.sin(latRad) * Math.sin(dec) +
                 Math.cos(latRad) * Math.cos(dec) * Math.cos(H)
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / deg
}

/**
 * Calculate total night time in decimal hours for a sequence of flight points.
 * Steps every 1 minute and linearly interpolates lat/lon between known points.
 * Night = solar elevation < -0.833°.
 */
export function calculateNightTimeHrs(points: FlightPoint[]): number {
  if (points.length < 2) return 0

  const STEP_MS  = 60_000  // 1 minute
  const NIGHT_EL = -0.833  // degrees (standard sunset threshold)

  let nightMs = 0

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const t1 = new Date(p1.timestamp).getTime()
    const t2 = new Date(p2.timestamp).getTime()
    if (t2 <= t1) continue

    for (let t = t1; t < t2; t += STEP_MS) {
      const frac = (t - t1) / (t2 - t1)
      const lat  = p1.lat + (p2.lat - p1.lat) * frac
      const lon  = p1.lon + (p2.lon - p1.lon) * frac
      const el   = getSolarElevationDeg(lat, lon, new Date(t))
      if (el < NIGHT_EL) nightMs += STEP_MS
    }
  }

  return Math.round((nightMs / 3_600_000) * 100) / 100
}

