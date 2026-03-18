import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
