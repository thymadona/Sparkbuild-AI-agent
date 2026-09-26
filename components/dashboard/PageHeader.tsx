import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeftIcon } from 'lucide-react'

// The top of every back-office page: an optional back arrow to the parent
// listing, the title, and the page's actions (the create button) top right.
export default function PageHeader({
  title,
  description,
  backHref,
  badge,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  backHref?: string
  badge?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-foreground">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
