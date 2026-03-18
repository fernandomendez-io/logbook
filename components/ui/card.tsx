import { cn } from '@/lib/utils/cn'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('bg-surface border border-border rounded-lg p-4', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn('text-sm font-semibold text-foreground/80 uppercase tracking-wider', className)}>
      {children}
    </h3>
  )
}
