'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteSequenceButtonProps {
  sequenceId: string
  flightCount: number
}

export function DeleteSequenceButton({ sequenceId, flightCount }: DeleteSequenceButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/sequences/${sequenceId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/sequences')
    } else {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-foreground/40 font-mono">
          Delete sequence + {flightCount} flight{flightCount !== 1 ? 's' : ''}?
        </span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-foreground/40 hover:text-foreground transition-colors px-2 py-0.5 rounded border border-border/40"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors px-2 py-0.5 rounded border border-red-800/50 hover:border-red-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Delete'}
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-foreground/25 hover:text-red-400 transition-colors px-2 py-0.5"
    >
      Delete
    </button>
  )
}
