'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CERT_TYPES } from '@/lib/aviation/certificates'

export function CertificateForm({ hasDob }: { hasDob: boolean }) {
  const router = useRouter()
  const [certType, setCertType] = useState('')
  const [certName, setCertName] = useState('')
  const [issuedDate, setIssuedDate] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isMedical = certType.startsWith('medical_')
  const autoExpiry = isMedical && hasDob && !expiresDate

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!certType || !certName) {
      setError('Certificate type and name are required')
      return
    }
    setError('')
    setSaving(true)

    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certType,
        certName,
        issuedDate: issuedDate || null,
        expiresDate: expiresDate || null,
        notes: notes || null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
      return
    }

    // Reset form
    setCertType('')
    setCertName('')
    setIssuedDate('')
    setExpiresDate('')
    setNotes('')
    router.refresh()
  }

  // Auto-fill cert name when type changes
  function handleTypeChange(val: string) {
    setCertType(val)
    const found = CERT_TYPES.find(t => t.value === val)
    if (found && !certName) setCertName(found.label)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Type"
          value={certType}
          onChange={e => handleTypeChange(e.target.value)}
          options={CERT_TYPES.map(t => ({ value: t.value, label: t.label }))}
          placeholder="Select type..."
        />
        <Input
          label="Name / Label"
          value={certName}
          onChange={e => setCertName(e.target.value)}
          placeholder="e.g. 1st Class Medical, E175 Type Rating"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Date Issued"
          type="date"
          value={issuedDate}
          onChange={e => setIssuedDate(e.target.value)}
        />
        <div>
          <Input
            label="Expiry Date"
            type="date"
            value={expiresDate}
            onChange={e => setExpiresDate(e.target.value)}
            placeholder={autoExpiry ? 'Auto-calculated from DOB' : ''}
          />
          {autoExpiry && (
            <p className="text-xs text-foreground/40 mt-1">
              Will be auto-calculated from your date of birth
            </p>
          )}
        </div>
      </div>

      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="e.g. AME, renewal date..."
      />

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" loading={saving}>Add Certificate</Button>
    </form>
  )
}
