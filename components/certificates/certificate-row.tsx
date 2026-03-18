'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { daysUntilExpiry, expiryStatus } from '@/lib/aviation/certificates'
import type { Database } from '@/lib/supabase/types'

type Certificate = Database['public']['Tables']['certificates']['Row']

export function CertificateRow({ cert, now }: { cert: Certificate; now: Date }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const days = cert.expires_date
    ? daysUntilExpiry(new Date(cert.expires_date), now)
    : null
  const status = days !== null ? expiryStatus(days) : 'ok'

  const badgeVariant = status === 'danger' ? 'red' : status === 'warning' ? 'yellow' : 'green'

  async function handleDelete() {
    if (!confirm(`Delete "${cert.cert_name}"?`)) return
    setDeleting(true)
    await fetch(`/api/certificates?id=${cert.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{cert.cert_name}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-foreground/50">
          {cert.issued_date && <span>Issued: {cert.issued_date}</span>}
          {cert.expires_date && <span>Expires: {cert.expires_date}</span>}
          {!cert.expires_date && <span className="text-foreground/30">No expiry</span>}
        </div>
        {cert.notes && (
          <p className="text-xs text-foreground/40 mt-0.5 truncate">{cert.notes}</p>
        )}
      </div>

      {days !== null && (
        <Badge variant={badgeVariant}>
          {days < 0
            ? `Expired ${Math.abs(days)}d ago`
            : days === 0
            ? 'Expires today'
            : `${days}d left`}
        </Badge>
      )}

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-foreground/30 hover:text-red-400 transition-colors ml-2 shrink-0"
        aria-label="Delete certificate"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}
