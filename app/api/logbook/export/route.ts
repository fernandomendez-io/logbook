import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  const s = String(v)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function utcTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(11, 16) + 'Z'
}

function utcDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, employee_number')
    .eq('id', user.id)
    .single()

  const { data: flights, error } = await supabase
    .from('flights')
    .select('*')
    .eq('pilot_id', user.id)
    .eq('is_cancelled', false)
    .lte('scheduled_out_utc', new Date().toISOString())
    .order('scheduled_out_utc', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = flights ?? []

  const headers = [
    'Date', 'Flight', 'Origin', 'Destination',
    'Sched OUT', 'Sched IN',
    'Actual OUT', 'Actual OFF', 'Actual ON', 'Actual IN',
    'Block Sched', 'Block Actual', 'Flight Time', 'Night',
    'PIC (Pilot Flying)', 'Landing Pilot', 'Approach', 'Runway',
    'Aircraft Type', 'Tail Number', 'Deadhead', 'Notes',
  ]

  const csvRows = [
    headers.join(','),
    ...rows.map(f => [
      cell(utcDate(f.scheduled_out_utc)),
      cell(f.flight_number),
      cell(f.origin_icao),
      cell(f.destination_icao),
      cell(utcTime(f.scheduled_out_utc)),
      cell(utcTime(f.scheduled_in_utc)),
      cell(utcTime(f.actual_out_utc)),
      cell(utcTime(f.actual_off_utc)),
      cell(utcTime(f.actual_on_utc)),
      cell(utcTime(f.actual_in_utc)),
      cell(f.block_scheduled_hrs?.toFixed(2) ?? ''),
      cell(f.block_actual_hrs?.toFixed(2) ?? ''),
      cell(f.flight_time_hrs?.toFixed(2) ?? ''),
      cell(f.night_time_hrs?.toFixed(2) ?? ''),
      cell(f.pilot_flying ?? ''),
      cell(f.landing_pilot ?? ''),
      cell(f.approach_type ?? ''),
      cell(f.approach_runway ?? ''),
      cell(f.aircraft_type ?? ''),
      cell(f.tail_number ?? ''),
      cell(f.is_deadhead ? 'Y' : ''),
      cell(f.notes ?? ''),
    ].join(',')),
  ]

  const csv = csvRows.join('\r\n')
  const pilotName = profile ? `${profile.first_name}_${profile.last_name}` : 'pilot'
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `logbook_${pilotName}_${dateStr}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
