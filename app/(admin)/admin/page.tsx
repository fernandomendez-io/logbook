import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/format'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('last_name', { ascending: true })

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  const pilots = users?.filter(u => u.role === 'pilot') || []
  const admins = users?.filter(u => u.role === 'admin') || []
  const active = users?.filter(u => u.is_active) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-foreground/50 mt-1">User and system management</p>
        </div>
        <Link href="/admin/invitations">
          <Button>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Send Invitation
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users?.length || 0 },
          { label: 'Pilots', value: pilots.length },
          { label: 'Admins', value: admins.length },
          { label: 'Pending Invites', value: invitations?.length || 0 },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-green-primary font-mono">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* User table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <Link href="/admin/users" className="text-xs text-green-primary hover:underline">Manage all →</Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-foreground/40 uppercase tracking-wider">
                <th className="text-left pb-2 pr-4">Name</th>
                <th className="text-left pb-2 pr-4">Employee #</th>
                <th className="text-left pb-2 pr-4">Base</th>
                <th className="text-left pb-2 pr-4">Seat</th>
                <th className="text-left pb-2 pr-4">Role</th>
                <th className="text-left pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {users?.map(u => (
                <tr key={u.id} className="hover:bg-surface-raised">
                  <td className="py-2.5 pr-4">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-green-primary transition-colors">
                      {u.first_name} {u.last_name}
                    </Link>
                    <p className="text-xs text-foreground/40">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-foreground/70">#{u.employee_number}</td>
                  <td className="py-2.5 pr-4 font-mono">{u.base || '—'}</td>
                  <td className="py-2.5 pr-4">
                    {u.seat ? <Badge variant="outline">{u.seat}</Badge> : <span className="text-foreground/30">—</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant={u.role === 'admin' ? 'yellow' : 'blue'}>{u.role}</Badge>
                  </td>
                  <td className="py-2.5">
                    <Badge variant={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending invitations */}
      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <Link href="/admin/invitations" className="text-xs text-green-primary hover:underline">Manage →</Link>
          </CardHeader>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 text-sm py-1">
                <span className="text-foreground/70">{inv.email}</span>
                {inv.employee_number && <span className="font-mono text-xs text-foreground/40">#{inv.employee_number}</span>}
                <Badge variant="outline">{inv.role}</Badge>
                <span className="text-xs text-foreground/30 ml-auto">Expires {formatDate(inv.expires_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
