import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'outline'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

export function Badge({ variant = 'gray', className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      {
        'bg-green-primary/15 text-green-primary': variant === 'green',
        'bg-yellow-500/15 text-yellow-400': variant === 'yellow',
        'bg-red-500/15 text-red-400': variant === 'red',
        'bg-blue-500/15 text-blue-400': variant === 'blue',
        'bg-foreground/10 text-foreground/60': variant === 'gray',
        'border border-border text-foreground/60': variant === 'outline',
      },
      className
    )}>
      {children}
    </span>
  )
}
