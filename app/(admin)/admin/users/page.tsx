'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/supabase/types'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (data.users) setUsers(data.users)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function toggleActive(user: Profile) {
    setUpdating(user.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    })
    await loadUsers()
    setUpdating(null)
  }

  async function toggleRole(user: Profile) {
    setUpdating(user.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, role: user.role === 'admin' ? 'pilot' : 'admin' }),
    })
    await loadUsers()
    setUpdating(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Manage Users</h1>
          <p className="text-sm text-foreground/50 mt-1">{users.length} accounts</p>
        </div>
        <Link href="/admin/invitations">
          <Button size="sm">Invite User</Button>
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised">
            <tr className="text-xs text-foreground/40 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Pilot</th>
              <th className="text-left px-4 py-3">Employee #</th>
              <th className="text-left px-4 py-3">Base / Seat</th>
              <th className="text-left px-4 py-3">Hire Date</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-foreground/40">Loading...</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className={!user.is_active ? 'opacity-50' : 'hover:bg-surface-raised'}>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-green-primary">
                    {user.first_name} {user.last_name}
                  </Link>
                  <p className="text-xs text-foreground/40">{user.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-foreground/70">#{user.employee_number}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-sm">{user.base || '—'}</span>
                  {user.seat && <Badge variant="outline" className="ml-2">{user.seat}</Badge>}
                </td>
                <td className="px-4 py-3 text-foreground/50 text-xs">{user.hire_date || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === 'admin' ? 'yellow' : 'blue'}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_active ? 'green' : 'red'}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={updating === user.id}
                      className="text-xs text-foreground/40 hover:text-foreground transition-colors"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <span className="text-foreground/20">·</span>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={updating === user.id}
                      className="text-xs text-foreground/40 hover:text-yellow-400 transition-colors"
                    >
                      {user.role === 'admin' ? '→ Pilot' : '→ Admin'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
