'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type ClassRow = {
  id: string
  name: string
  description: string | null
  studentCount: number
  pendingReviewCount: number
}

export default function TeacherDashboardClient({ classes }: { classes: ClassRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return classes
    return classes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [classes, search])

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search classes…"
        className="w-64 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-600 focus:outline-none"
      />

      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Class</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Students</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Pending review</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((cls) => (
              <tr key={cls.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-100">{cls.name}</div>
                  {cls.description && (
                    <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{cls.description}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-md bg-gray-800 px-2.5 py-0.5 text-sm font-medium text-gray-200">
                    {cls.studentCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {cls.pendingReviewCount > 0 ? (
                    <span className="rounded-md bg-amber-950 border border-amber-800 px-2.5 py-0.5 text-xs text-amber-300">
                      {cls.pendingReviewCount} waiting
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/teacher/classes/${cls.id}`}
                    className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-600">
                  {search ? 'No classes match your search.' : 'No classes assigned yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
