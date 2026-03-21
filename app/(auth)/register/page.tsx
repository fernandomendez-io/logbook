'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CARRIERS } from '@/lib/data/carriers'

const CARRIER_OPTIONS = [
  { value: '', label: 'Select your airline…' },
  ...CARRIERS.map(c => ({ value: c.value, label: c.label })),
]

export default function RegisterPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    employeeNumber: '',
    carrier: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.carrier) { setError('Please select your airline'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)

    const selectedCarrier = CARRIERS.find(c => c.value === form.carrier)

    const supabase = createClient()
    const { error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name:        form.firstName,
          last_name:         form.lastName,
          employee_number:   form.employeeNumber,
          operating_carrier: form.carrier,
          flight_prefix:     selectedCarrier?.displayPrefix ?? null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }

    router.push('/verify-email')
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 md:p-8 shadow-2xl w-full max-w-sm">
      <h1 className="text-lg font-semibold text-foreground mb-1">Create your account</h1>
      <p className="text-sm text-foreground/40 mb-6">Enter your details to get started</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={e => set('firstName', e.target.value)}
            required
            autoComplete="given-name"
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={e => set('lastName', e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Employee #"
          value={form.employeeNumber}
          onChange={e => set('employeeNumber', e.target.value)}
          placeholder="e.g. 12345"
          required
        />

        <Select
          label="Airline"
          value={form.carrier}
          onChange={e => set('carrier', e.target.value)}
          options={CARRIER_OPTIONS}
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="you@airline.com"
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={e => set('password', e.target.value)}
          placeholder="Min. 8 characters"
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={e => set('confirmPassword', e.target.value)}
          placeholder="Repeat password"
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-foreground/40 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-green-primary hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
