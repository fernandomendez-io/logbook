import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, createAdminAuthClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, employeeNumber, role } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Use service client to bypass RLS for insert
  const service = await createServiceClient()

  const { data: invite, error } = await service
    .from('invitations')
    .insert({
      invited_by: user.id,
      email,
      employee_number: employeeNumber || null,
      role: role || 'pilot',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'An invitation for this email already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // In production, send an email via Supabase's built-in email or a service like Resend
  // The invite URL contains the token for registration
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // redirectTo: after Supabase verifies the invite link, user lands here to complete profile
  const redirectTo = `${appUrl}/auth/callback?token=${invite.token}`

  const adminAuth = createAdminAuthClient()
  const { error: inviteError } = await adminAuth.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (inviteError) {
    // Roll back the invitation record so it can be retried
    await service.from('invitations').delete().eq('id', invite.id)
    return NextResponse.json({ error: `Failed to send invite email: ${inviteError.message}` }, { status: 500 })
  }

  return NextResponse.json({ invitation: invite }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json()
  const { error } = await supabase.from('invitations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
