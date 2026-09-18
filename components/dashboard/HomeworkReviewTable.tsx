'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SubmissionStatus } from '@/types'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: 'Waiting for review',
  approved: 'Approved',
  needs_work: 'Sent back',
}

const STATUS_VARIANT: Record<SubmissionStatus, 'warning' | 'success' | 'destructive'> = {
  submitted: 'warning',
  approved: 'success',
  needs_work: 'destructive',
}

export interface HomeworkReviewRow {
  projectId: string
  studentName: string
  studentEmail: string
  lessonTitle: string
  status: SubmissionStatus
  homeworkDone: number
  homeworkTotal: number
  updatedAt: string
}

// Shared by the global queue (app/staff/homework) and the Homework tab on a
// single class (app/staff/classes/[id]) — same review flow against
// POST /api/admin/homework/[id]/review either way, differing only in which
// rows the caller's page.tsx fetches.
export default function HomeworkReviewTable({ rows }: { rows: HomeworkReviewRow[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No homework has been handed in yet.</p>
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Handed in</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.projectId} className="align-top">
                <TableCell>
                  <div className="text-foreground">{row.studentName || row.studentEmail}</div>
                  {row.studentName && <div className="text-xs text-muted-foreground">{row.studentEmail}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.lessonTitle}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.homeworkDone}/{row.homeworkTotal}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <a
                        href={`/share/${row.projectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-input px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        See their page
                      </a>
                      <button
                        onClick={() => {
                          setOpenId(openId === row.projectId ? null : row.projectId)
                          setFeedback('')
                        }}
                        className="rounded border border-input px-2 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        {openId === row.projectId ? 'Cancel' : 'Review'}
                      </button>
                    </div>

                    {openId === row.projectId && (
                      <div className="w-72 rounded-md border border-border bg-popover p-3">
                        <label htmlFor={`feedback-${row.projectId}`} className="block text-xs text-muted-foreground">
                          Note for the student
                        </label>
                        <textarea
                          id={`feedback-${row.projectId}`}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          rows={3}
                          placeholder="Short and kind. Required when sending back."
                          className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => review(row.projectId, 'approved')}
                            disabled={busy}
                            className="flex-1 rounded bg-success px-2 py-1.5 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => review(row.projectId, 'needs_work')}
                            disabled={busy || !feedback.trim()}
                            className="flex-1 rounded bg-warning px-2 py-1.5 text-xs font-medium text-warning-foreground hover:bg-warning/90 disabled:opacity-50"
                          >
                            Ask for more
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
