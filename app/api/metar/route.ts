import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMetarAtTime } from '@/lib/api/aviationweather'
import { parseMetar } from '@/lib/aviation/metar-parser'
import { classifyApproach } from '@/lib/aviation/approach-classifier'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const station = searchParams.get('station')?.toUpperCase()
  const timeStr = searchParams.get('time')  // ISO UTC string

  if (!station || !timeStr) {
    return NextResponse.json({ error: 'station and time are required' }, { status: 400 })
  }

  const targetTime = new Date(timeStr)
  if (isNaN(targetTime.getTime())) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
  }

  // Check cache: find METAR within 90 minutes before the target time
  const windowStart = new Date(targetTime.getTime() - 90 * 60000).toISOString()
  const { data: cached } = await supabase
    .from('metar_cache')
    .select('*')
    .eq('station_icao', station)
    .gte('observation_utc', windowStart)
    .lte('observation_utc', targetTime.toISOString())
    .order('observation_utc', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    const parsed = cached.parsed as unknown as ReturnType<typeof parseMetar>
    const suggestion = classifyApproach(parsed.ceilingFt, parsed.visibilitySm)
    return NextResponse.json({ metar: cached.raw_metar, parsed, suggestion, source: 'cache' })
  }

  // Fetch live
  const result = await fetchMetarAtTime(station, targetTime)
  if (!result) {
    return NextResponse.json({ error: 'METAR not available for that station/time' }, { status: 404 })
  }

  const parsed = parseMetar(result.rawOb)
  const suggestion = classifyApproach(parsed.ceilingFt, parsed.visibilitySm)

  // Cache it
  await supabase.from('metar_cache').upsert({
    station_icao: station,
    observation_utc: result.observationTime,
    raw_metar: result.rawOb,
    parsed: parsed as any,
  }, { onConflict: 'station_icao,observation_utc' })

  return NextResponse.json({ metar: result.rawOb, parsed, suggestion, source: 'live' })
}
