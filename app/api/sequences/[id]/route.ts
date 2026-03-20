import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, pilot_id')
    .eq('id', id)
    .single()

  if (!sequence || sequence.pilot_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Delete all flights in this sequence first
  // (FK is ON DELETE SET NULL, so they wouldn't auto-delete)
  const { error: flightErr } = await supabase
    .from('flights')
    .delete()
    .eq('sequence_id', id)

  if (flightErr) return NextResponse.json({ error: flightErr.message }, { status: 500 })

  // Delete the sequence itself
  const { error: seqErr } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id)

  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
