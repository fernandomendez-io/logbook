import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/format'
import { CARRIERS } from '@/lib/data/carriers'
import ProfileEditForm from '@/components/profile/profile-edit-form'
import { GoogleCalendarCard } from '@/components/calendar/google-calendar-card'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const db = supabase as any
  const { data: gcCreds } = await db
    .from('google_credentials')
    .select('user_id, calendar_id')
    .eq('user_id', user.id)
    .single()
  const googleConnected = !!gcCreds
  const calendarId: string | null = gcCreds?.calendar_id ?? null

  const { data: stats } = await supabase
    .from('flights')
    .select('flight_time_hrs, block_actual_hrs, approach_type, aircraft_type, is_cancelled')
    .eq('pilot_id', user.id)
    .eq('is_cancelled', false)

  const totalFlight = stats?.reduce((s, f) => s + (f.flight_time_hrs || 0), 0) || 0
  const totalBlock = stats?.reduce((s, f) => s + (f.block_actual_hrs || 0), 0) || 0
  const ilsCount = stats?.filter(f => f.approach_type === 'ILS').length || 0
  const rnavCount = stats?.filter(f => f.approach_type === 'RNAV' || f.approach_type === 'RNP').length || 0
  const e175Count = stats?.filter(f => f.aircraft_type === 'E175').length || 0
  const e170Count = stats?.filter(f => f.aircraft_type === 'E170').length || 0

  const carrierLabel = CARRIERS.find(c => c.value === profile.operating_carrier)?.label

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-primary/20 flex items-center justify-center text-xl font-bold text-green-primary">
              {profile.first_name?.[0]}{profile.last_name?.[0]}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{profile.first_name} {profile.last_name}</h2>
              <p className="text-sm text-foreground/50">{user.email}</p>
              {carrierLabel && <p className="text-xs text-green-primary/70 mt-0.5">{carrierLabel}</p>}
            </div>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          {[
            { label: 'Employee #', value: `#${profile.employee_number}` },
            { label: 'Seat',       value: profile.seat || '—' },
            { label: 'Base',       value: profile.base || '—' },
            { label: 'Hire Date',  value: profile.hire_date ? formatDate(profile.hire_date) : '—' },
            { label: 'Role',       value: profile.role },
            { label: 'Flight Prefix', value: profile.flight_prefix ? `${profile.flight_prefix}NNNN` : '—' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-0.5">{item.label}</p>
              <p className="text-sm font-medium font-mono">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <ProfileEditForm initial={{
        firstName:        profile.first_name ?? '',
        lastName:         profile.last_name ?? '',
        employeeNumber:   profile.employee_number ?? '',
        seat:             profile.seat ?? '',
        base:             profile.base ?? '',
        operatingCarrier: profile.operating_carrier ?? '',
      }} />

      <GoogleCalendarCard connected={googleConnected} calendarId={calendarId} />

      <Card>
        <CardHeader><CardTitle>Lifetime Totals</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Flight Time', value: `${totalFlight.toFixed(1)} hrs` },
            { label: 'Block Time', value: `${totalBlock.toFixed(1)} hrs` },
            { label: 'Total Legs', value: stats?.length || 0 },
            { label: 'ILS Approaches', value: ilsCount },
            { label: 'RNAV/RNP', value: rnavCount },
            { label: 'E175 Time', value: `${e175Count} legs` },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-xl font-bold text-green-primary font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
