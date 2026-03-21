import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAirportTimezone } from '@/lib/data/airport-cache'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ icao: string }> },
) {
  const { icao } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const timezone = await getAirportTimezone(icao.toUpperCase(), supabase)
  return NextResponse.json({ timezone })
}
