import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/format'

export default async function AdminFlightsPage({
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

  // Build flights query — join profiles for pilot info
  let query = supabase
    .from('flights')
    .select(`
      id, flight_number, scheduled_out_utc, origin_icao, destination_icao,
      actual_out_utc, actual_in_utc, is_cancelled, is_deadhead, fa_flight_id,
      pilot_id,
      profiles!flights_pilot_id_fkey(first_name, last_name, employee_number)
    `)
    .order('scheduled_out_utc', { ascending: false })
    .limit(200)

  if (pilotId) {
    query = query.eq('pilot_id', pilotId)
  }

  const { data: flights } = await query
  const f = flights as any[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">All Flights</h1>
          <p className="text-sm text-foreground/50 mt-1">
            {pilotProfile
              ? `${pilotProfile.first_name} ${pilotProfile.last_name} (#${pilotProfile.employee_number})`
              : `${f?.length ?? 0} most recent flights`}
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
              href="/admin/flights"
              className="text-sm px-3 py-1.5 rounded-md text-foreground/40 hover:text-foreground transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {!f?.length ? (
        <Card className="py-16 text-center text-foreground/40 text-sm">
          {employee ? `No flights found for employee #${employee}.` : 'No flights.'}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Pilot</th>
                <th className="text-left px-4 py-3">Emp #</th>
                <th className="text-left px-4 py-3">Flight</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Route</th>
                <th className="text-left px-4 py-3">OUT</th>
                <th className="text-left px-4 py-3">IN</th>
                <th className="text-left px-4 py-3">Track</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {f.map((flight: any) => {
                const profile = flight.profiles as any
                return (
                  <tr
                    key={flight.id}
                    className="hover:bg-surface-raised transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/admin/flights?employee=${profile?.employee_number ?? ''}`}
                        className="hover:text-green-primary transition-colors"
                      >
                        {profile?.first_name} {profile?.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground/60">
                      #{profile?.employee_number}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/flights/${flight.id}`} className="font-mono font-semibold text-green-primary hover:underline">
                        {flight.flight_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-foreground/60 text-xs">
                      {formatDate(flight.scheduled_out_utc)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {flight.origin_icao} → {flight.destination_icao}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                      {flight.actual_out_utc
                        ? new Date(flight.actual_out_utc).toISOString().slice(11, 16) + 'Z'
                        : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">
                      {flight.actual_in_utc
                        ? new Date(flight.actual_in_utc).toISOString().slice(11, 16) + 'Z'
                        : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {flight.fa_flight_id
                        ? <span className="text-xs text-green-primary">✓</span>
                        : <span className="text-xs text-foreground/30">—</span>}
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
