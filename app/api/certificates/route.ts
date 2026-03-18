import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateMedicalExpiry } from '@/lib/aviation/certificates'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('pilot_id', user.id)
    .order('expires_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ certificates: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { certType, certName, issuedDate, expiresDate, notes } = body

  if (!certType || !certName) {
    return NextResponse.json({ error: 'cert_type and cert_name are required' }, { status: 400 })
  }

  // Auto-calculate expiry for medicals if not explicitly provided
  let computedExpiry = expiresDate || null
  if (!computedExpiry && issuedDate && ['medical_1st', 'medical_2nd', 'medical_3rd'].includes(certType)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('date_of_birth')
      .eq('id', user.id)
      .single()

    if (profile?.date_of_birth) {
      const classMap: Record<string, '1st' | '2nd' | '3rd'> = {
        medical_1st: '1st',
        medical_2nd: '2nd',
        medical_3rd: '3rd',
      }
      const expiry = calculateMedicalExpiry(
        new Date(issuedDate),
        classMap[certType],
        new Date(profile.date_of_birth),
      )
      computedExpiry = expiry.toISOString().slice(0, 10)
    }
  }

  const { data, error } = await supabase
    .from('certificates')
    .insert({
      pilot_id: user.id,
      cert_type: certType,
      cert_name: certName,
      issued_date: issuedDate || null,
      expires_date: computedExpiry,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ certificate: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('certificates')
    .delete()
    .eq('id', id)
    .eq('pilot_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
