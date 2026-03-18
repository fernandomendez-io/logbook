import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { daysUntilExpiry, expiryStatus, CERT_TYPES } from '@/lib/aviation/certificates'
import { CertificateForm } from '@/components/certificates/certificate-form'
import { CertificateRow } from '@/components/certificates/certificate-row'

export default async function CertificatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: certs }, { data: profile }] = await Promise.all([
    supabase
      .from('certificates')
      .select('*')
      .eq('pilot_id', user.id)
      .order('expires_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('profiles')
      .select('date_of_birth, first_name, last_name')
      .eq('id', user.id)
      .single(),
  ])

  const certificates = certs ?? []
  const now = new Date()

  // Sort: expired/danger first, then warning, then ok, then no-expiry
  const sorted = [...certificates].sort((a, b) => {
    const da = a.expires_date ? daysUntilExpiry(new Date(a.expires_date), now) : 9999
    const db = b.expires_date ? daysUntilExpiry(new Date(b.expires_date), now) : 9999
    return da - db
  })

  const expiringSoon = sorted.filter(c => {
    if (!c.expires_date) return false
    const days = daysUntilExpiry(new Date(c.expires_date), now)
    return days < 60
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Certificates & Medicals</h1>
        <p className="text-sm text-foreground/50 mt-1">
          Track expiration dates for medicals, type ratings, and flight reviews
        </p>
      </div>

      {/* Expiry alerts */}
      {expiringSoon.length > 0 && (
        <div className="space-y-2">
          {expiringSoon.map(c => {
            const days = daysUntilExpiry(new Date(c.expires_date!), now)
            const status = expiryStatus(days)
            return (
              <div
                key={c.id}
                className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm ${
                  status === 'danger'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>
                  <strong>{c.cert_name}</strong>{' '}
                  {days < 0
                    ? `expired ${Math.abs(days)} days ago`
                    : days === 0
                    ? 'expires today'
                    : `expires in ${days} days`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Certificate list */}
      <Card className="p-0 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-3 border-b border-border">
          <CardTitle>Your Certificates</CardTitle>
          <span className="text-xs text-foreground/40">{certificates.length} on file</span>
        </CardHeader>

        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-foreground/40">
            No certificates added yet. Add your 1st class medical below to get started.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {sorted.map(cert => (
              <CertificateRow key={cert.id} cert={cert} now={now} />
            ))}
          </div>
        )}
      </Card>

      {/* Add certificate form */}
      <Card>
        <CardHeader><CardTitle>Add Certificate</CardTitle></CardHeader>
        <CertificateForm hasDob={Boolean(profile?.date_of_birth)} />
        {!profile?.date_of_birth && (
          <p className="text-xs text-foreground/40 mt-3">
            Tip: Add your date of birth in your Profile to enable automatic medical expiry calculation.
          </p>
        )}
      </Card>
    </div>
  )
}
