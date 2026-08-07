'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import DeactivateToggle from '@/components/admin/DeactivateToggle'
import AddToClassModal from '@/components/admin/AddToClassModal'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import CreateStudentModal from '@/components/admin/CreateStudentModal'
import EditStudentModal from '@/components/admin/EditStudentModal'
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f.label}
              <span className={`rounded px-1.5 py-0.5 text-xs ${
                filter === f.id ? 'bg-gray-600 text-gray-200' : 'bg-gray-800 text-gray-500'
              }`}>
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
            className="w-56 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-gray-600 focus:outline-none"
          />
          <CreateStudentModal />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Student</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Payment</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Active</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Joined</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-100">
                    {u.name || <span className="text-gray-600 italic">No name</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {u.classes.length > 0
                      ? u.classes.map((c) => (
                          <span key={c} className="rounded-md bg-violet-950 border border-violet-800 px-2 py-0.5 text-xs text-violet-300">{c}</span>
                        ))
                      : <span className="text-gray-600 text-xs">—</span>
                    }
                    {u.hasProfile && (
                      <AddToClassModal userId={u.id} studentName={u.name || u.email} classes={classes} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.payment ? (
                    <div className="flex gap-1.5">
                      {u.payment.unpaid > 0 && (
                        <span className="rounded-md bg-red-950 border border-red-800 px-2 py-0.5 text-xs text-red-300">
                          {u.payment.unpaid} unpaid
                        </span>
                      )}
                      {u.payment.paid > 0 && (
                        <span className="rounded-md bg-green-950 border border-green-800 px-2 py-0.5 text-xs text-green-300">
                          {u.payment.paid} paid
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {u.hasProfile ? (
                    <div className="flex justify-center">
                      <DeactivateToggle userId={u.id} initialActive={u.isActive} />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {u.hasProfile && (
                      <EditStudentModal student={{
                        userId: u.id,
                        fullName: u.name,
                        parentEmail: u.parentEmail,
                        parentTelegramChatId: u.parentTelegramChatId,
                        notes: u.notes,
                      }} />
                    )}
                    {u.hasProfile && (
                      <CreateInvoiceModal userId={u.id} studentName={u.name || u.email} />
                    )}
                    <Link
                      href={`/staff/students/${u.id}`}
                      className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600"
                    >
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                  {search || filter !== 'all' ? 'No students match your filter.' : 'No students yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">{filtered.length} of {rows.length} students</p>
    </div>
  )
}
