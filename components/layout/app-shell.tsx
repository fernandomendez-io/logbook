'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import type { Profile } from '@/lib/supabase/types'

interface AppShellProps {
  profile: Profile | null
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar always visible; mobile controlled by state */}
      <Sidebar
        profile={profile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground/60 hover:text-foreground"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <path d="M4 20L16 4L28 20H20V28H12V20H4Z" fill="#4ade80" fillOpacity="0.9"/>
          </svg>
          <span className="text-sm font-bold text-green-primary tracking-widest uppercase">Logbook</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
