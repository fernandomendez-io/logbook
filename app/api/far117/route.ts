import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildFAR117Status } from '@/lib/aviation/far117'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pilotId = searchParams.get('pilot') || user.id

  // Call the DB function for rolling window calculations
  const { data, error } = await supabase.rpc('compute_far117', {
    p_pilot_id: pilotId,
    p_as_of: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = data?.[0] || { flight_time_28d_hrs: 0, flight_time_365d_hrs: 0, duty_time_7d_hrs: 0 }

  // Get last duty release time
  const { data: lastDuty } = await supabase
    .from('duty_periods')
    .select('duty_end_utc')
    .eq('pilot_id', pilotId)
    .not('duty_end_utc', 'is', null)
    .order('duty_end_utc', { ascending: false })
    .limit(1)
    .single()

  const status = buildFAR117Status({
    flightTime28dHrs: Number(row.flight_time_28d_hrs),
    flightTime365dHrs: Number(row.flight_time_365d_hrs),
    dutyTime7dHrs: Number(row.duty_time_7d_hrs),
    lastDutyEndUtc: lastDuty?.duty_end_utc ? new Date(lastDuty.duty_end_utc) : null,
  })

  return NextResponse.json({ status })
}
