import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createCalendar, listCalendars } from '@/lib/api/google-calendar'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/profile?error=google_denied`)
  }

  // Verify CSRF nonce
  const cookieStore = await cookies()
  const nonce = cookieStore.get('google_oauth_nonce')?.value
  if (!nonce || nonce !== state) {
    return NextResponse.redirect(`${appUrl}/profile?error=google_csrf`)
  }
  cookieStore.delete('google_oauth_nonce')

  // Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      code,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokenRes.ok || !tokens.access_token || !tokens.refresh_token) {
    console.error('[Google OAuth] token exchange failed:', tokens)
    return NextResponse.redirect(`${appUrl}/profile?error=google_token`)
  }

  // Get the authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  const expiryAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
  const db = supabase as any

  // Find or create the dedicated "Logbook Flights" calendar
  let calendarId = 'primary'
  try {
    // Check if user already has a non-primary calendar saved (reconnect case)
    const { data: existing } = await db
      .from('google_credentials')
      .select('calendar_id')
      .eq('user_id', user.id)
      .single()

    if (existing?.calendar_id && existing.calendar_id !== 'primary') {
      calendarId = existing.calendar_id
    } else {
      // Look for an existing "Logbook Flights" calendar before creating a new one
      const allCalendars = await listCalendars(tokens.access_token)
      const existing = allCalendars.find(c => c.summary === 'Logbook Flights')
      if (existing) {
        calendarId = existing.id
      } else {
        const created = await createCalendar(tokens.access_token, 'Logbook Flights')
        calendarId = created.id
      }
    }
  } catch (err) {
    console.error('[Google OAuth] calendar setup failed:', err)
    // Fall back to primary — sync will still work
  }

  // Store credentials
  await db.from('google_credentials').upsert({
    user_id:       user.id,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_at:     expiryAt,
    calendar_id:   calendarId,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.redirect(`${appUrl}/profile?connected=google`)
}
