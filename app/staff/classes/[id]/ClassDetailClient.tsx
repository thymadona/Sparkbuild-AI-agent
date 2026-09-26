'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'
import ClassFormModal, { type PersonOption } from '@/components/admin/ClassFormModal'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import DataTable from '@/components/dashboard/DataTable'
import PageHeader from '@/components/dashboard/PageHeader'
import StatCard from '@/components/dashboard/StatCard'
import { Button } from '@/components/ui/button'

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
  canOpenStudents,
}: {
  classId: string
  className: string
  description: string | null
  schedules: ClassSchedule[]
  students: Student[]
  availableStudents: PersonOption[]
  teachers: PersonOption[]
  availableTeachers: PersonOption[]
  // students:manage: only then does a student row open /staff/students/[id].
  canOpenStudents: boolean
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function deleteClass() {
    if (
      !confirm(
        `Delete "${className}"? This removes its schedule and unenrolls all students. This cannot be undone.`
      )
    )
      return
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
      <PageHeader
        backHref="/staff/classes"
        title={className}
        description={description}
        actions={
          <>
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
              trigger={
                <Button variant="outline">
                  <PencilIcon />
                  Edit class
                </Button>
              }
            />
            <Button
              variant="outline"
              onClick={deleteClass}
              disabled={deleting}
              className="text-destructive"
            >
              <Trash2Icon />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="users" label="Enrolled students" value={students.length} />
        <StatCard icon="collected" label="Paid" value={paidCount} tone="success" />
        <StatCard icon="outstanding" label="Unpaid" value={unpaidCount} tone="destructive" />
      </div>

      {/* Schedule */}
      <Card>
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Weekly Schedule</h3>
          <div className="space-y-2">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded bg-muted px-3 py-2.5 text-sm"
              >
                <span className="w-10 font-medium text-foreground">
                  {DAYS_SHORT[s.day_of_week]}
                </span>
                <span className="text-foreground">{formatTime(s.start_time)}</span>
                <span className="text-muted-foreground/70">·</span>
                <span className="text-muted-foreground">{s.duration_min} min</span>
                {s.label && <span className="text-muted-foreground">· {s.label}</span>}
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground/70">
                No time slots yet — use Edit class to add one.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Teachers ({teachers.length})</h2>
        <DataTable
          rows={teachers}
          getRowId={(t) => t.userId}
          noun="teachers"
          emptyText="No teacher assigned yet. Students in this class won't appear in any teacher's view until you add one."
          columns={[
            {
              id: 'name',
              header: 'Name',
              sortValue: (t) => t.name.toLowerCase(),
              cell: (t) => (
                <span className="font-medium text-foreground">
                  {t.name || <span className="italic text-muted-foreground/70">No name</span>}
                </span>
              ),
            },
            {
              id: 'email',
              header: 'Email',
              cell: (t) => <span className="text-muted-foreground">{t.email}</span>,
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Students ({students.length})</h2>
        <DataTable
          rows={students}
          getRowId={(s) => s.userId}
          rowHref={canOpenStudents ? (s) => `/staff/students/${s.userId}` : undefined}
          noun="students"
          emptyText="No students enrolled yet."
          search={{ placeholder: 'Search students', text: (s) => `${s.name} ${s.email}` }}
          filters={[
            {
              id: 'payment',
              label: 'Payment',
              options: [
                { value: 'all', label: 'All' },
                { value: 'unpaid', label: 'Has unpaid' },
                { value: 'paid', label: 'Paid up' },
              ],
              match: (s, v) =>
                v === 'unpaid' ? s.unpaidCount > 0 : s.unpaidCount === 0 && s.paidCount > 0,
            },
          ]}
          columns={[
            {
              id: 'name',
              header: 'Name',
              sortValue: (s) => s.name.toLowerCase(),
              cell: (s) => (
                <span className="font-medium text-foreground">
                  {s.name || <span className="italic text-muted-foreground/70">No name</span>}
                </span>
              ),
            },
            {
              id: 'email',
              header: 'Email',
              cell: (s) => <span className="text-muted-foreground">{s.email}</span>,
            },
            {
              id: 'payment',
              header: 'Payment',
              sortValue: (s) => s.unpaidCount,
              cell: (s) => (
                <div className="flex gap-1.5">
                  {s.unpaidCount > 0 && <Badge variant="destructive">{s.unpaidCount} unpaid</Badge>}
                  {s.paidCount > 0 && <Badge variant="success">{s.paidCount} paid</Badge>}
                  {s.paidCount === 0 && s.unpaidCount === 0 && (
                    <span className="text-xs text-muted-foreground/70">—</span>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  )
}
