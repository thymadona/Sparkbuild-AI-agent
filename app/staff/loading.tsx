import OverviewSkeleton from './OverviewSkeleton'

// Renders inside DashboardShell while the segment resolves. Also structural:
// a dynamic route without a loading boundary answers RSC prefetches with a
// bare 204, which is misleading in production logs.
export default function StaffOverviewLoading() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <div className="mt-2 h-3 w-40 rounded bg-gray-900 animate-pulse" />
      </div>
      <OverviewSkeleton />
    </div>
  )
}
