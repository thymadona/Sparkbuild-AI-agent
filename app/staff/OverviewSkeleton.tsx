import { Skeleton } from '@/components/ui/skeleton'

// Shared by app/staff/loading.tsx (the whole segment, before the session and
// permissions resolve) and app/staff/page.tsx's Suspense boundary (the stats
// fan-out, after the shell has rendered).
export default function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-20" />
    </div>
  )
}
