import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAirportInfo } from '@/lib/api/flightaware'

/**
 * Returns the IANA timezone for an airport.
 * Checks the DB cache first; if missing, fetches from FA /airports/{icao} and caches it.
 * Returns null if the airport can't be resolved (FA error or unknown code).
 */
export async function getAirportTimezone(
  icao: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const db = supabase as any
  const { data: cached } = await db
    .from('airports')
    .select('timezone')
    .eq('airport_code', icao)
    .single()

  if (cached?.timezone) return cached.timezone

  const airport = await fetchAirportInfo(icao)
  if (!airport) return null

  await db.from('airports').upsert({
    airport_code: airport.airport_code,
    code_icao:    airport.code_icao,
    code_iata:    airport.code_iata,
    code_lid:     airport.code_lid,
    name:         airport.name,
    type:         airport.type,
    elevation:    airport.elevation,
    city:         airport.city,
    state:        airport.state,
    country_code: airport.country_code,
    longitude:    airport.longitude,
    latitude:     airport.latitude,
    timezone:     airport.timezone,
    wiki_url:     airport.wiki_url,
    fetched_at:   new Date().toISOString(),
  }, { onConflict: 'airport_code' })

  return airport.timezone
}
