import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMetarAtTime } from '@/lib/api/aviationweather'
import { parseMetar } from '@/lib/aviation/metar-parser'
import { classifyApproach } from '@/lib/aviation/approach-classifier'

/** Normalize IATA (3-letter) to ICAO (4-letter) for US airports */
export function toIcao(station: string): string {
  if (station.length === 3) return `K${station}`
  return station
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rawStation = searchParams.get('station')?.toUpperCase()
  const timeStr = searchParams.get('time')  // ISO UTC string

  if (!rawStation || !timeStr) {
    return NextResponse.json({ error: 'station and time are required' }, { status: 400 })
  }

  const targetTime = new Date(timeStr)
  if (isNaN(targetTime.getTime())) {
    return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
  }

  // Normalize IATA → ICAO before querying or caching
  const station = toIcao(rawStation)

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

  // Fetch live from AWC
  const result = await fetchMetarAtTime(station, targetTime)
  if (!result) {
    return NextResponse.json({ error: `METAR not available for ${station}` }, { status: 404 })
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
