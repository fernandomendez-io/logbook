'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', employeeNumber: '',
    seat: 'FO', base: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  // True when the user already has a Supabase session (arrived via invite email link)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    const supabase = createClient()

    Promise.all([
      supabase.from('invitations')
        .select('email, accepted_at, expires_at, employee_number')
        .eq('token', token)
        .single(),
      supabase.auth.getUser(),
    ]).then(([{ data, error: inviteErr }, { data: { user } }]) => {
      if (inviteErr || !data) { setTokenValid(false); return }
      if (data.accepted_at) { setTokenValid(false); setError('This invitation has already been used.'); return }
      if (new Date(data.expires_at) < new Date()) { setTokenValid(false); setError('This invitation has expired.'); return }
      setTokenValid(true)
      setInviteEmail(data.email)
      setForm(f => ({
        ...f,
        email: data.email,
        employeeNumber: (data as any).employee_number || '',
      }))
      if (user) setHasSession(true)
    })
  }, [token])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)

    const supabase = createClient()

    if (hasSession) {
      // User arrived via Supabase invite email — already exists in auth.users.
      // Set their password and profile metadata, then mark the invite accepted.
      const { error: updateErr } = await supabase.auth.updateUser({
        password: form.password,
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          employee_number: form.employeeNumber,
          seat: form.seat,
          base: form.base.toUpperCase(),
        },
      })
      if (updateErr) { setError(updateErr.message); setLoading(false); return }

      // Mark invitation accepted
      await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token)

      router.push('/dashboard')
    } else {
      // Fallback: no session yet — use standard signUp with email confirmation.
      const { error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            employee_number: form.employeeNumber,
            seat: form.seat,
            base: form.base.toUpperCase(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?token=${token}`,
        },
      })
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
      router.push('/verify-email')
    }
  }

  if (tokenValid === null) {
    return <div className="text-center text-foreground/50 text-sm">Validating invitation...</div>
  }

  if (tokenValid === false) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-red-400 mb-2 font-medium">Invalid or expired invitation</p>
        <p className="text-sm text-foreground/50">{error || 'Please request a new invitation from your administrator.'}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-8 shadow-2xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">Create your account</h1>
      <p className="text-sm text-foreground/50 mb-6">
        Invited as: <span className="text-green-primary">{inviteEmail}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
          <Input label="Last Name" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Employee #" value={form.employeeNumber} onChange={e => set('employeeNumber', e.target.value)} placeholder="e.g. 12345" required />
          <Input label="Base (ICAO)" value={form.base} onChange={e => set('base', e.target.value)} placeholder="ORD" maxLength={3} />
        </div>
        <Select
          label="Seat"
          value={form.seat}
          onChange={e => set('seat', e.target.value)}
          options={[{ value: 'CA', label: 'Captain (CA)' }, { value: 'FO', label: 'First Officer (FO)' }]}
        />
        <Input label="Email" type="email" value={form.email} disabled className="opacity-60" />
        <Input label="Password" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters" required />
        <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" required />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {hasSession ? 'Complete Setup' : 'Create Account'}
        </Button>
      </form>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-foreground/50 text-sm">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
