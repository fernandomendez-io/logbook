import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const employeeNumber = searchParams.get('employee')

  if (!employeeNumber) return NextResponse.json({ error: 'employee number required' }, { status: 400 })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, employee_number, seat, base')
    .eq('employee_number', employeeNumber)
    .single()

  if (error || !profile) return NextResponse.json({ error: 'Pilot not found' }, { status: 404 })

  return NextResponse.json({ pilot: profile })
}
