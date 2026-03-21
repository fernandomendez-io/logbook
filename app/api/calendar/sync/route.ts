import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken, upsertCalendarEvent, type CalendarEvent } from '@/lib/api/google-calendar'
import { utcDtToLocal } from '@/lib/utils/timezone'
import { getAirportTimezone } from '@/lib/data/airport-cache'
import { CARRIERS } from '@/lib/data/carriers'

/** Strip the operating-carrier alpha prefix, prepend the mainline carrier code.
 *  "MQ4179" + "AA" → "AA4179", "4179" + "AA" → "AA4179", "MQ 4179" + "AA" → "AA4179" */
function buildFlightLabel(
  flightNumber: string | null,
  mainlinePrefix: string | null,
  origin: string,
  dest: string,
): string {
  if (!flightNumber) return `${origin}–${dest}`
  if (!mainlinePrefix) return flightNumber
  // Remove any leading alpha chars (operating carrier code) + optional space
  const numPart = flightNumber.replace(/^[A-Za-z]+\s*/, '')
  return numPart ? `${mainlinePrefix}${numPart}` : flightNumber
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sequenceId } = await request.json()
  if (!sequenceId) return NextResponse.json({ error: 'sequenceId required' }, { status: 400 })

  // Get Google credentials
  const db = supabase as any
  const { data: creds } = await db
    .from('google_credentials')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!creds) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 401 })
  }

  // Resolve mainline carrier code for calendar title formatting (e.g. MQ→AA for Envoy pilots)
  const { data: profile } = await supabase
    .from('profiles')
    .select('operating_carrier')
    .eq('id', user.id)
    .single()
  const operatingCarrier = (profile as { operating_carrier?: string } | null)?.operating_carrier ?? null
  const mainlinePrefix = operatingCarrier
    ? (CARRIERS.find(c => c.value === operatingCarrier)?.mainline ?? null)
    : null

  // Refresh access token if expiring within 60 seconds
  let accessToken: string = creds.access_token
  if (new Date(creds.expiry_at).getTime() < Date.now() + 60_000) {
    try {
      const refreshed = await refreshAccessToken(creds.refresh_token)
      accessToken = refreshed.accessToken
      await db.from('google_credentials').update({
        access_token: refreshed.accessToken,
        expiry_at:    refreshed.expiryAt,
        updated_at:   new Date().toISOString(),
      }).eq('user_id', user.id)
    } catch (err) {
      console.error('[Calendar sync] token refresh failed:', err)
      return NextResponse.json({ error: 'Token refresh failed — reconnect Google Calendar' }, { status: 401 })
    }
  }

  // Fetch flights for this sequence
  const { data: flights, error: flightErr } = await supabase
    .from('flights')
    .select('id, flight_number, origin_icao, destination_icao, scheduled_out_utc, scheduled_in_utc, actual_out_utc, actual_in_utc, origin_timezone, dest_timezone, is_deadhead, is_cancelled, google_event_id')
    .eq('sequence_id', sequenceId)
    .eq('pilot_id', user.id)
    .order('scheduled_out_utc', { ascending: true })

  if (flightErr) return NextResponse.json({ error: flightErr.message }, { status: 500 })
  if (!flights?.length) return NextResponse.json({ synced: 0 })

  // Resolve any missing timezones from the airport cache up front
  const missingTzIcaos = new Set<string>()
  for (const f of flights as any[]) {
    if (!f.is_cancelled) {
      if (!f.origin_timezone && f.origin_icao) missingTzIcaos.add(f.origin_icao)
      if (!f.dest_timezone   && f.destination_icao) missingTzIcaos.add(f.destination_icao)
    }
  }
  const resolvedTz: Record<string, string> = {}
  await Promise.all(
    Array.from(missingTzIcaos).map(async (icao) => {
      const tz = await getAirportTimezone(icao, supabase)
      if (tz) resolvedTz[icao] = tz
    }),
  )

  let synced = 0

  for (const flight of flights) {
    const f = flight as any

    // Skip cancelled flights
    if (f.is_cancelled) continue

    const originTz = f.origin_timezone || resolvedTz[f.origin_icao] || 'UTC'
    const destTz   = f.dest_timezone   || resolvedTz[f.destination_icao] || 'UTC'

    // Prefer actual times (convert UTC→local); fall back to nominal scheduled.
    // Append :00 to satisfy RFC 3339 (Google requires HH:MM:SS, not just HH:MM).
    const startDt = (f.actual_out_utc
      ? utcDtToLocal(f.actual_out_utc.slice(0, 16), originTz) || f.scheduled_out_utc.slice(0, 16)
      : f.scheduled_out_utc.slice(0, 16)) + ':00'

    const endDt = (f.actual_in_utc
      ? utcDtToLocal(f.actual_in_utc.slice(0, 16), destTz) || f.scheduled_in_utc.slice(0, 16)
      : f.scheduled_in_utc.slice(0, 16)) + ':00'

    const flightLabel = buildFlightLabel(f.flight_number, mainlinePrefix, f.origin_icao, f.destination_icao)
    const isActual = !!(f.actual_out_utc)

    const event: CalendarEvent = {
      summary:     `${flightLabel} ${f.origin_icao}–${f.destination_icao}${f.is_deadhead ? ' (DH)' : ''}`,
      description: [
        `${f.origin_icao} → ${f.destination_icao}`,
        isActual ? 'Actual times' : 'Scheduled times',
        f.is_deadhead ? 'Deadhead' : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime: startDt, timeZone: originTz },
      end:   { dateTime: endDt,   timeZone: destTz },
      colorId: f.is_deadhead ? '9' : '2',  // 9=blueberry, 2=sage
    }

    try {
      const eventId = await upsertCalendarEvent(accessToken, creds.calendar_id, f.google_event_id ?? null, event)

      // Store event ID so future syncs update instead of creating duplicates
      if (eventId !== f.google_event_id) {
        await supabase.from('flights').update({ google_event_id: eventId } as any).eq('id', f.id)
      }
      synced++
    } catch (err) {
      console.error(`[Calendar sync] failed for flight ${f.id}:`, err)
    }
  }

  return NextResponse.json({ synced })
}
