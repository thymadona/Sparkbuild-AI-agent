'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'
import ClassFormModal, { type PersonOption } from '@/components/admin/ClassFormModal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
    <div className="space-y-6">
      {/* Class name */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{className}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
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
            className="rounded border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete class'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{students.length}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">enrolled students</div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 ring-success/20">
          <CardContent>
            <div className="text-2xl font-bold text-success">{paidCount}</div>
            <div className="mt-0.5 text-xs text-success/80">paid</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 ring-destructive/20">
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{unpaidCount}</div>
            <div className="mt-0.5 text-xs text-destructive/80">unpaid</div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule */}
      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Weekly Schedule</h3>
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded bg-muted px-3 py-2.5 text-sm">
                <span className="w-10 font-medium text-foreground">{DAYS_SHORT[s.day_of_week]}</span>
                <span className="text-foreground">{formatTime(s.start_time)}</span>
                <span className="text-muted-foreground/70">·</span>
                <span className="text-muted-foreground">{s.duration_min} min</span>
                {s.label && <span className="text-muted-foreground">· {s.label}</span>}
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground/70">No time slots yet — use Edit class to add one.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Teachers */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Teachers ({teachers.length})</h3>
        </div>
        {teachers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">
            No teacher assigned to this class yet — students in this class won&apos;t appear in anyone&apos;s classes tab until one is.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.userId}>
                  <TableCell className="font-medium text-foreground">
                    {t.name || <span className="italic text-muted-foreground/70">No name</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Students */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Students ({students.length})</h3>
        </div>
        {students.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">No students enrolled yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.userId}>
                  <TableCell className="font-medium text-foreground">
                    {s.name || <span className="italic text-muted-foreground/70">No name</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {s.unpaidCount > 0 && <Badge variant="destructive">{s.unpaidCount} unpaid</Badge>}
                      {s.paidCount > 0 && <Badge variant="success">{s.paidCount} paid</Badge>}
                      {s.paidCount === 0 && s.unpaidCount === 0 && (
                        <span className="text-xs text-muted-foreground/70">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
