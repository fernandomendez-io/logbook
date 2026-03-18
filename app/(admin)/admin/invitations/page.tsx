'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/format'

interface Invitation {
  id: string
  email: string
  employee_number: string | null
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  token: string
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [role, setRole] = useState('pilot')
  const [sending, setSending] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadInvitations() {
    const res = await fetch('/api/admin/invitations')
    const data = await res.json()
    if (data.invitations) setInvitations(data.invitations)
    setLoading(false)
  }

  useEffect(() => { loadInvitations() }, [])

  async function sendInvitation() {
    if (!email) return
    setSending(true)
    setError('')
    setSentEmail('')
    const res = await fetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, employeeNumber, role }),
    })
    const data = await res.json()
    setSending(false)
    if (data.invitation) {
      setSentEmail(email)
      setEmail('')
      setEmployeeNumber('')
      loadInvitations()
    } else {
      setError(data.error || 'Failed to send invitation')
    }
  }

  async function revokeInvitation(id: string) {
    await fetch('/api/admin/invitations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadInvitations()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invitations</h1>
        <p className="text-sm text-foreground/50 mt-1">Invite pilots to create accounts</p>
      </div>

      {/* Send form */}
      <Card>
        <CardHeader><CardTitle>Send Invitation</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="pilot@airline.com"
            />
          </div>
          <Input
            label="Employee #"
            value={employeeNumber}
            onChange={e => setEmployeeNumber(e.target.value)}
            placeholder="12345"
          />
        </div>
        <div className="mt-4 flex gap-4 items-end">
          <div className="w-40">
            <Select
              label="Role"
              value={role}
              onChange={e => setRole(e.target.value)}
              options={[{ value: 'pilot', label: 'Pilot' }, { value: 'admin', label: 'Admin' }]}
            />
          </div>
          <Button onClick={sendInvitation} loading={sending} disabled={!email}>
            Send Invitation
          </Button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        {sentEmail && (
          <div className="mt-4 p-3 bg-green-primary/10 border border-green-primary/20 rounded-lg">
            <p className="text-xs text-green-primary font-medium">Invitation sent!</p>
            <p className="text-xs text-foreground/50 mt-0.5">
              An email was sent to <span className="text-foreground">{sentEmail}</span> with a link to create their account.
            </p>
          </div>
        )}
      </Card>

      {/* List */}
      <Card>
        <CardHeader><CardTitle>All Invitations</CardTitle></CardHeader>
        {loading ? (
          <p className="text-sm text-foreground/40">Loading...</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-foreground/40">No invitations yet</p>
        ) : (
          <div className="space-y-2">
            {invitations.map(inv => {
              const expired = new Date(inv.expires_at) < new Date()
              const accepted = !!inv.accepted_at
              return (
                <div key={inv.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-foreground/40">
                      {inv.employee_number && `#${inv.employee_number} · `}
                      Sent {formatDate(inv.created_at)}
                      {accepted && ` · Accepted ${formatDate(inv.accepted_at!)}`}
                      {!accepted && !expired && ` · Expires ${formatDate(inv.expires_at)}`}
                    </p>
                  </div>
                  <Badge variant="outline">{inv.role}</Badge>
                  <Badge variant={accepted ? 'green' : expired ? 'red' : 'yellow'}>
                    {accepted ? 'Accepted' : expired ? 'Expired' : 'Pending'}
                  </Badge>
                  {!accepted && (
                    <button
                      onClick={() => revokeInvitation(inv.id)}
                      className="text-xs text-foreground/30 hover:text-red-400 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
