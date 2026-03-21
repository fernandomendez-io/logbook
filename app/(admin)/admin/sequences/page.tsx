import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/format'

export default async function AdminSequencesPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>
}) {
  const { employee } = await searchParams
  const supabase = await createServiceClient()

  // Look up pilot by employee number if filter is set
  let pilotId: string | null = null
  let pilotProfile: { first_name: string; last_name: string; employee_number: string } | null = null

  if (employee) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, employee_number')
      .eq('employee_number', employee)
      .single()

    if (profile) {
      pilotId = profile.id
      pilotProfile = profile
    }
  }

  // Query sequences with flight count and pilot info
  let query = supabase
    .from('sequences')
    .select(`
      id, name, start_date, end_date, pilot_id,
      profiles!sequences_pilot_id_fkey(first_name, last_name, employee_number)
    `)
    .order('start_date', { ascending: false })
    .limit(200)

  if (pilotId) {
    query = query.eq('pilot_id', pilotId)
  }

  const { data: sequences } = await query
  const seqs = sequences as any[]

  // Get flight counts per sequence in one query
  let flightCounts: Record<string, number> = {}
  if (seqs?.length) {
    const seqIds = seqs.map((s: any) => s.id)
    const { data: counts } = await supabase
      .from('flights')
      .select('sequence_id')
      .in('sequence_id', seqIds)

    if (counts) {
      flightCounts = counts.reduce((acc: Record<string, number>, row: any) => {
        acc[row.sequence_id] = (acc[row.sequence_id] || 0) + 1
        return acc
      }, {})
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">All Sequences</h1>
          <p className="text-sm text-foreground/50 mt-1">
            {pilotProfile
              ? `${pilotProfile.first_name} ${pilotProfile.last_name} (#${pilotProfile.employee_number})`
              : `${seqs?.length ?? 0} most recent sequences`}
          </p>
        </div>

        {/* Employee number search */}
        <form method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="employee"
            defaultValue={employee ?? ''}
            placeholder="Employee #"
            className="text-sm font-mono px-3 py-1.5 rounded-md border border-border bg-surface text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-green-dim w-32"
          />
          <button
            type="submit"
            className="text-sm px-3 py-1.5 rounded-md border border-border text-foreground/60 hover:text-foreground hover:border-green-dim transition-colors"
          >
            Filter
          </button>
          {employee && (
            <Link
              href="/admin/sequences"
              className="text-sm px-3 py-1.5 rounded-md text-foreground/40 hover:text-foreground transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {!seqs?.length ? (
        <Card className="py-16 text-center text-foreground/40 text-sm">
          {employee ? `No sequences found for employee #${employee}.` : 'No sequences.'}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Pilot</th>
                <th className="text-left px-4 py-3">Emp #</th>
                <th className="text-left px-4 py-3">Sequence</th>
                <th className="text-left px-4 py-3">Start</th>
                <th className="text-left px-4 py-3">End</th>
                <th className="text-left px-4 py-3">Flights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {seqs.map((seq: any) => {
                const profile = seq.profiles as any
                const count = flightCounts[seq.id] ?? 0
                return (
                  <tr
                    key={seq.id}
                    className="hover:bg-surface-raised transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/admin/sequences?employee=${profile?.employee_number ?? ''}`}
                        className="hover:text-green-primary transition-colors"
                      >
                        {profile?.first_name} {profile?.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground/60">
                      #{profile?.employee_number}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/sequences/${seq.id}`} className="font-medium text-green-primary hover:underline">
                        {seq.name || <span className="text-foreground/40">Unnamed</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                      {seq.start_date ? formatDate(seq.start_date + 'T00:00:00Z') : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                      {seq.end_date ? formatDate(seq.end_date + 'T00:00:00Z') : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                      {count}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
