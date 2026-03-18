'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FetchTimesButtonProps {
  flightId: string
  hasActualTimes?: boolean
}

export function FetchTimesButton({ flightId, hasActualTimes }: FetchTimesButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'ok' | 'err' | 'notfound' | null>(null)

  async function handleFetch() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/flights/${flightId}/acars`, { method: 'POST' })
      if (res.ok) {
        setResult('ok')
        router.refresh()
      } else if (res.status === 404) {
        setResult('notfound')
      } else {
        setResult('err')
      }
    } catch {
      setResult('err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); handleFetch() }}
        disabled={loading}
        className="text-xs font-mono px-2 py-1 rounded border border-border text-foreground/50 hover:border-green-dim hover:text-green-primary transition-colors disabled:opacity-40 whitespace-nowrap"
        title={hasActualTimes ? 'Refresh FR24 data' : 'Fetch times from FR24'}
      >
        {loading ? '…' : hasActualTimes ? '↻' : 'Fetch'}
      </button>
      {result === 'ok'       && <span className="text-xs text-green-primary">✓</span>}
      {result === 'notfound' && <span className="text-xs text-yellow-400" title="No FR24 data found">—</span>}
      {result === 'err'      && <span className="text-xs text-red-400">!</span>}
    </div>
  )
}
