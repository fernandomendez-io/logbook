import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface PaginationProps {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <Link
        href={buildHref(page - 1)}
        aria-disabled={page === 1}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          page === 1
            ? 'text-foreground/20 pointer-events-none'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-raised'
        )}
      >
        ←
      </Link>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-foreground/30 text-sm">…</span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors font-mono',
              p === page
                ? 'bg-green-primary/15 text-green-primary font-medium'
                : 'text-foreground/60 hover:text-foreground hover:bg-surface-raised'
            )}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={buildHref(page + 1)}
        aria-disabled={page === totalPages}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          page === totalPages
            ? 'text-foreground/20 pointer-events-none'
            : 'text-foreground/60 hover:text-foreground hover:bg-surface-raised'
        )}
      >
        →
      </Link>
    </div>
  )
}
