'use client'

interface TimeDisplayProps {
  iso: string | null
  isActual?: boolean
}

export function TimeDisplay({ iso, isActual = false }: TimeDisplayProps) {
  if (!iso) {
    return (
      <p className="text-lg font-mono font-bold text-foreground/20">—</p>
    )
  }

  const date = new Date(iso)
  const utcTime = date.toISOString().slice(11, 16) + 'Z'
  const localTime = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  return (
    <div>
      <p className={`text-lg font-mono font-bold ${isActual ? 'text-green-primary' : 'text-foreground/50'}`}>
        {utcTime}
      </p>
      <p className="text-xs text-foreground/30 font-mono mt-0.5">{localTime}</p>
    </div>
  )
}
