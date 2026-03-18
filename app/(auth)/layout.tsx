import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | Pilot Logbook',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 20L16 4L28 20H20V28H12V20H4Z" fill="#4ade80" fillOpacity="0.9"/>
              <path d="M12 20H20V28H12V20Z" fill="#22c55e"/>
            </svg>
            <span className="text-xl font-bold text-green-primary tracking-tight">LOGBOOK</span>
          </div>
          <p className="text-sm text-foreground/40">Pilot Flight Logbook System</p>
        </div>
        {children}
      </div>
    </div>
  )
}
