'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TeacherSubmissionRow } from './page'
import type { SubmissionStatus } from '@/types'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: 'Waiting for review',
  approved: 'Approved',
  needs_work: 'Sent back',
}

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-teal-100 text-teal-800',
  needs_work: 'bg-red-100 text-red-800',
}

interface Props {
  className: string
  students: { userId: string; name: string; email: string }[]
  homeworkRows: TeacherSubmissionRow[]
}

export default function TeacherClassClient({ className, students, homeworkRows }: Props) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waiting = homeworkRows.filter((row) => row.status === 'submitted')

  async function review(projectId: string, status: SubmissionStatus) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/homework/${projectId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save the review')
      setOpenId(null)
      setFeedback('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">{className}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {waiting.length === 0
            ? 'Nothing waiting for review.'
            : `${waiting.length} ${waiting.length === 1 ? 'submission' : 'submissions'} waiting for review.`}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-300">Roster ({students.length})</h2>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">No students in this class yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <span key={s.userId} className="rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300">
                {s.name || s.email}
              </span>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-300">Homework</h2>
        {homeworkRows.length === 0 ? (
          <p className="text-sm text-gray-500">No homework has been handed in yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Week</th>
                  <th className="px-4 py-2 font-medium">Tasks</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Handed in</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {homeworkRows.map((row) => (
                  <tr key={row.projectId} className="align-top">
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{row.studentName || row.studentEmail}</div>
                      {row.studentName && <div className="text-xs text-gray-500">{row.studentEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{row.lessonTitle}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.homeworkDone}/{row.homeworkTotal}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <a
                            href={`/share/${row.projectId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                          >
                            See their page
                          </a>
                          <button
                            onClick={() => {
                              setOpenId(openId === row.projectId ? null : row.projectId)
                              setFeedback('')
                            }}
                            className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                          >
                            {openId === row.projectId ? 'Cancel' : 'Review'}
                          </button>
                        </div>

                        {openId === row.projectId && (
                          <div className="w-72 rounded-md border border-gray-800 bg-gray-950 p-3">
                            <label htmlFor={`feedback-${row.projectId}`} className="block text-xs text-gray-400">
                              Note for the student
                            </label>
                            <textarea
                              id={`feedback-${row.projectId}`}
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                              rows={3}
                              placeholder="Short and kind. Required when sending back."
                              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-200 placeholder:text-gray-600"
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => review(row.projectId, 'approved')}
                                disabled={busy}
                                className="flex-1 rounded bg-teal-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => review(row.projectId, 'needs_work')}
                                disabled={busy || !feedback.trim()}
                                className="flex-1 rounded bg-amber-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                              >
                                Ask for more
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
