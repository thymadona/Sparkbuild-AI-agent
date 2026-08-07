'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'
import ClassFormModal, { type PersonOption } from '@/components/admin/ClassFormModal'

type Student = PersonOption & { paidCount: number; unpaidCount: number }

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function ClassDetailClient({
  classId,
  className,
  description,
  schedules,
  students,
  availableStudents,
  teachers,
  availableTeachers,
}: {
  classId: string
  className: string
  description: string | null
  schedules: ClassSchedule[]
  students: Student[]
  availableStudents: PersonOption[]
  teachers: PersonOption[]
  availableTeachers: PersonOption[]
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function deleteClass() {
    if (!confirm(`Delete "${className}"? This removes its schedule and unenrolls all students. This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/classes/${classId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/staff/classes')
    } else {
      setDeleting(false)
    }
  }

  const paidCount = students.filter((s) => s.paidCount > 0).length
  const unpaidCount = students.filter((s) => s.unpaidCount > 0).length
  const allTeachers = [...teachers, ...availableTeachers]
  const allStudents = [...students, ...availableStudents]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Class name */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">{className}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ClassFormModal
            mode="edit"
            classId={classId}
            initialName={className}
            initialDescription={description}
            initialSchedules={schedules}
            initialTeachers={teachers}
            initialStudents={students}
            allTeachers={allTeachers}
            allStudents={allStudents}
          />
          <button
            onClick={deleteClass}
            disabled={deleting}
            className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/50 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete class'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-gray-100">{students.length}</div>
          <div className="mt-0.5 text-xs text-gray-500">enrolled students</div>
        </div>
        <div className="rounded-xl border border-green-900/50 bg-green-950/30 p-4">
          <div className="text-2xl font-bold text-green-300">{paidCount}</div>
          <div className="mt-0.5 text-xs text-green-600">paid</div>
        </div>
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
          <div className="text-2xl font-bold text-red-300">{unpaidCount}</div>
          <div className="mt-0.5 text-xs text-red-600">unpaid</div>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">Weekly Schedule</h3>
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2.5 text-sm">
              <span className="w-10 font-medium text-gray-200">{DAYS_SHORT[s.day_of_week]}</span>
              <span className="text-gray-300">{formatTime(s.start_time)}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-400">{s.duration_min} min</span>
              {s.label && <span className="text-gray-500">· {s.label}</span>}
            </div>
          ))}
          {schedules.length === 0 && <p className="text-sm text-gray-600">No time slots yet — use Edit class to add one.</p>}
        </div>
      </div>

      {/* Teachers */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-300">Teachers ({teachers.length})</h3>
        </div>
        {teachers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-600">
            No teacher assigned to this class yet — students in this class won&apos;t appear in anyone&apos;s classes tab until one is.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {teachers.map((t) => (
                <tr key={t.userId} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-100">{t.name || <span className="italic text-gray-600">No name</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Students */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-300">Students ({students.length})</h3>
        </div>
        {students.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-600">No students enrolled yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {students.map((s) => (
                <tr key={s.userId} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-100">{s.name || <span className="italic text-gray-600">No name</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {s.unpaidCount > 0 && <span className="rounded-md bg-red-950 border border-red-800 px-2 py-0.5 text-xs text-red-300">{s.unpaidCount} unpaid</span>}
                      {s.paidCount > 0 && <span className="rounded-md bg-green-950 border border-green-800 px-2 py-0.5 text-xs text-green-300">{s.paidCount} paid</span>}
                      {s.paidCount === 0 && s.unpaidCount === 0 && <span className="text-xs text-gray-600">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
