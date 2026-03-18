import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('last_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...updates } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only allow safe fields
  const allowed = ['role', 'is_active', 'seat', 'base', 'hire_date']
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabase
    .from('profiles')
    .update(filtered)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
