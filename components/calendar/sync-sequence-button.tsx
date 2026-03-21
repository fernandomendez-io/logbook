'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  sequenceId: string
}

export function SyncSequenceButton({ sequenceId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [syncCount, setSyncCount] = useState(0)

  async function handleSync() {
    setState('loading')
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncCount(data.synced)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-green-primary font-mono">
        ✓ {syncCount} flight{syncCount !== 1 ? 's' : ''} synced
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span className="text-xs text-red-400 font-mono cursor-pointer" onClick={handleSync}>
        Sync failed — retry
      </span>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSync}
      loading={state === 'loading'}
      title="Sync flights to Google Calendar"
    >
      <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z" opacity=".3"/>
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z"/>
      </svg>
      Sync to Calendar
    </Button>
  )
}
