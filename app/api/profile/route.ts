import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name:        body.firstName ?? undefined,
      last_name:         body.lastName ?? undefined,
      employee_number:   body.employeeNumber ?? undefined,
      seat:              body.seat ?? undefined,
      base:              body.base ?? undefined,
      operating_carrier: body.operatingCarrier ?? undefined,
      flight_prefix:     body.flightPrefix ?? undefined,
    })
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
