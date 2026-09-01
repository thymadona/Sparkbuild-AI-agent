import OverviewSkeleton from './OverviewSkeleton'

// Renders inside DashboardShell while this segment's data resolves. Its other
// job is structural: /staff is dynamic (getSessionUser reads headers()), and a
// dynamic route with no loading boundary answers an RSC prefetch with a bare
// 204 No Content. The sidebar puts <Link href="/staff"> on every staff page,
// so those prefetches are constant — and their 204s are what a production log
// shows for this route, which is misleading when something else is slow.
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
