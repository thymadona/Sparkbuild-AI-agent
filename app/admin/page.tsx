import { Suspense } from 'react'
import OverviewTab from './tabs/OverviewTab'

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-900 border border-gray-800" />
        ))}
      </div>
      <div className="h-48 rounded-lg bg-gray-900 border border-gray-800" />
    </div>
  )
}

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your school</p>
      </div>
      <Suspense fallback={<Skeleton />}>
        <OverviewTab />
      </Suspense>
    </div>
  )
}
