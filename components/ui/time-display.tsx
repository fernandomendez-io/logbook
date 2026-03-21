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

  const utcTime = new Date(iso).toISOString().slice(11, 16)

  return (
    <p className={`text-lg font-mono font-bold ${isActual ? 'text-green-primary' : 'text-foreground/50'}`}>
      {utcTime}
    </p>
  )
}
