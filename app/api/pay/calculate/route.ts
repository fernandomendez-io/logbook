import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePayPeriod } from '@/lib/pay/calculator'
import type { Flight } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')   // YYYY-MM-DD
  const end = searchParams.get('end')       // YYYY-MM-DD

  if (!start || !end) return NextResponse.json({ error: 'start and end dates required' }, { status: 400 })

  const { data: flights, error } = await supabase
    .from('flights')
    .select('*')
    .eq('pilot_id', user.id)
    .gte('scheduled_out_utc', `${start}T00:00:00Z`)
    .lte('scheduled_out_utc', `${end}T23:59:59Z`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = calculatePayPeriod(flights as Flight[], start, end)
  return NextResponse.json({ summary })
}
