/**
 * Google Calendar API client — direct HTTP, no googleapis SDK dependency.
 * Handles token refresh and event create/update (upsert).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

export interface CalendarEvent {
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end:   { dateTime: string; timeZone: string }
  colorId?: string  // '2' = sage (normal flights), '9' = blueberry (deadheads)
}

/** Exchange a refresh token for a new access token. Returns new token + ISO expiry string. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiryAt: string }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error ?? res.status}`)
  }
  const expiryAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString()
  return { accessToken: data.access_token, expiryAt }
}

/**
 * Creates a new event or updates an existing one.
 * Pass eventId=null to create; pass an existing event ID to update.
 * Returns the Google Calendar event ID.
 */
export async function upsertCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string | null,
  event: CalendarEvent,
): Promise<string> {
  const encodedCalId = encodeURIComponent(calendarId)
  const url = eventId
    ? `${CALENDAR_BASE}/calendars/${encodedCalId}/events/${encodeURIComponent(eventId)}`
    : `${CALENDAR_BASE}/calendars/${encodedCalId}/events`

  const res = await fetch(url, {
    method: eventId ? 'PUT' : 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    const body = await res.text()
    // Event no longer exists on Google side — treat as new
    if (res.status === 404 && eventId) {
      return upsertCalendarEvent(accessToken, calendarId, null, event)
    }
    throw new Error(`Calendar API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.id as string
}

/** List the authenticated user's calendars. */
export async function listCalendars(
  accessToken: string,
): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Calendar list ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.items ?? []).map((item: { id: string; summary: string; primary?: boolean }) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
  }))
}

/** Create a new calendar with the given name. Returns its id and summary. */
export async function createCalendar(
  accessToken: string,
  name: string,
): Promise<{ id: string; summary: string }> {
  const res = await fetch(`${CALENDAR_BASE}/calendars`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: name }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Calendar create ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return { id: data.id as string, summary: data.summary as string }
}

/** Delete a calendar event. Silently ignores 404 (already gone). */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const encodedCalId = encodeURIComponent(calendarId)
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodedCalId}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  if (!res.ok && res.status !== 404) {
    throw new Error(`Calendar delete ${res.status}`)
  }
}
