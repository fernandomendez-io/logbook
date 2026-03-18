import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseSequence } from '@/lib/parsers/sequence-parser'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawText, yearMonth } = await request.json()
  if (!rawText?.trim()) return NextResponse.json({ error: 'rawText is required' }, { status: 400 })

  try {
    const parsed = parseSequence(rawText, yearMonth)
    return NextResponse.json({ parsed })
  } catch (err) {
    console.error('Sequence parse error:', err)
    return NextResponse.json({ error: 'Failed to parse sequence' }, { status: 422 })
  }
}
