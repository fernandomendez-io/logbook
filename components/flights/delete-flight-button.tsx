'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteFlightButtonProps {
  flightId: string
}

export function DeleteFlightButton({ flightId }: DeleteFlightButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/flights/${flightId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-foreground/40 hover:text-foreground transition-colors px-1"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors px-1 disabled:opacity-50"
        >
          {loading ? '…' : 'Confirm'}
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-foreground/25 hover:text-red-400 transition-colors px-1"
    >
      Delete
    </button>
  )
}
