// Shared by app/staff/loading.tsx (the whole segment, before the session and
// permissions resolve) and app/staff/page.tsx's Suspense boundary (the stats
// fan-out, after the shell has rendered).
export default function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
    </div>
  )
}
