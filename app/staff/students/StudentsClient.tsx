'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import DeactivateToggle from '@/components/admin/DeactivateToggle'
import AddToClassModal from '@/components/admin/AddToClassModal'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import CreateStudentModal from '@/components/admin/CreateStudentModal'
import EditStudentModal from '@/components/admin/EditStudentModal'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Class } from '@/types'

type StudentRow = {
  id: string
  email: string
  name: string
  isActive: boolean
  hasProfile: boolean
  parentEmail: string
  parentTelegramChatId: string
  notes: string
  classes: string[]
  payment: { paid: number; unpaid: number } | null
  createdAt: string
}

type Filter = 'all' | 'unpaid' | 'inactive' | 'no-class'

export default function StudentsClient({
  rows,
  classes,
}: {
  rows: StudentRow[]
  classes: Class[]
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase()
      if (q && !r.name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false
      if (filter === 'unpaid' && !(r.payment && r.payment.unpaid > 0)) return false
      if (filter === 'inactive' && r.isActive) return false
      if (filter === 'no-class' && r.classes.length > 0) return false
      return true
    })
  }, [rows, search, filter])

  const unpaidCount = rows.filter((r) => r.payment && r.payment.unpaid > 0).length
  const inactiveCount = rows.filter((r) => !r.isActive).length
  const noClassCount = rows.filter((r) => r.classes.length === 0).length

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: rows.length },
    { id: 'unpaid', label: 'Unpaid', count: unpaidCount },
    { id: 'inactive', label: 'Inactive', count: inactiveCount },
    { id: 'no-class', label: 'No Class', count: noClassCount },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${
                  filter === f.id
                    ? 'bg-background text-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-56 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <CreateStudentModal />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {u.name || <span className="text-muted-foreground/70 italic">No name</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {u.classes.length > 0 ? (
                      u.classes.map((c) => (
                        <Badge key={c} variant="secondary">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground/70 text-xs">—</span>
                    )}
                    {u.hasProfile && (
                      <AddToClassModal
                        userId={u.id}
                        studentName={u.name || u.email}
                        classes={classes}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {u.payment ? (
                    <div className="flex gap-1.5">
                      {u.payment.unpaid > 0 && (
                        <Badge variant="destructive">{u.payment.unpaid} unpaid</Badge>
                      )}
                      {u.payment.paid > 0 && <Badge variant="success">{u.payment.paid} paid</Badge>}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/70 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {u.hasProfile ? (
                    <div className="flex justify-center">
                      <DeactivateToggle userId={u.id} initialActive={u.isActive} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/70">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-2">
                    {u.hasProfile && (
                      <EditStudentModal
                        student={{
                          userId: u.id,
                          fullName: u.name,
                          parentEmail: u.parentEmail,
                          parentTelegramChatId: u.parentTelegramChatId,
                          notes: u.notes,
                        }}
                      />
                    )}
                    {u.hasProfile && (
                      <CreateInvoiceModal userId={u.id} studentName={u.name || u.email} />
                    )}
                    <Link
                      href={`/staff/students/${u.id}`}
                      className="rounded bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                    >
                      Details
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground/70"
                >
                  {search || filter !== 'all'
                    ? 'No students match your filter.'
                    : 'No students yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground/70">
        {filtered.length} of {rows.length} students
      </p>
    </div>
  )
}
