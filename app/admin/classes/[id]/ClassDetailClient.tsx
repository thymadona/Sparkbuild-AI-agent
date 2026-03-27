'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'

type Student = {
  userId: string
  name: string
  email: string
  paidCount: number
  unpaidCount: number
}

type AvailableStudent = { userId: string; name: string; email: string }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ── Inline slot editor ────────────────────────────────────────────────
function SlotRow({
  slot,
  onDelete,
}: {
  slot: ClassSchedule
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    day_of_week: slot.day_of_week,
    start_time: slot.start_time.slice(0, 5),
    duration_min: slot.duration_min,
    label: slot.label ?? '',
  })

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/admin/schedules?id=${slot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-800 px-3 py-2">
        <select
          value={form.day_of_week}
          onChange={(e) => set('day_of_week', Number(e.target.value))}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
        >
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <input
          type="time"
          value={form.start_time}
          onChange={(e) => set('start_time', e.target.value)}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
        />
        <input
          type="number"
          min={15}
          max={480}
          value={form.duration_min}
          onChange={(e) => set('duration_min', Number(e.target.value))}
          className="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
          placeholder="min"
        />
        <input
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
          placeholder="Label (opt)"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <span className="w-20 font-medium text-gray-200">{DAYS[slot.day_of_week]}</span>
        <span className="text-gray-300">{formatTime(slot.start_time)}</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400">{slot.duration_min} min</span>
        {slot.label && <span className="text-gray-500">· {slot.label}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setEditing(true)}
          className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(slot.id)}
          className="rounded px-2 py-0.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Add new slot row ──────────────────────────────────────────────────
function AddSlotRow({ classId }: { classId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ day_of_week: 1, start_time: '09:00', duration_min: 60, label: '' })

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/admin/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, ...form }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
      >
        <span className="text-lg leading-none">+</span> Add time slot
      </button>
    )
  }

  return (
    <form onSubmit={save} className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-700 px-3 py-2.5">
      <select
        value={form.day_of_week}
        onChange={(e) => set('day_of_week', Number(e.target.value))}
        className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
      >
        {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
      <input
        type="time"
        value={form.start_time}
        onChange={(e) => set('start_time', e.target.value)}
        className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
      />
      <input
        type="number"
        min={15}
        max={480}
        value={form.duration_min}
        onChange={(e) => set('duration_min', Number(e.target.value))}
        className="w-20 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
        placeholder="min"
      />
      <input
        value={form.label}
        onChange={(e) => set('label', e.target.value)}
        className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200"
        placeholder="Label (opt)"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {saving ? '…' : 'Add'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">
        Cancel
      </button>
    </form>
  )
}

// ── Add student dropdown ──────────────────────────────────────────────
function AddStudentRow({
  classId,
  available,
}: {
  classId: string
  available: AvailableStudent[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)

  const filtered = available.filter((s) => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  async function add(userId: string) {
    setAdding(userId)
    await fetch(`/api/admin/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setAdding(null)
    setOpen(false)
    setSearch('')
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
      >
        + Add Student
      </button>
    )
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-8 z-20 w-72 rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="p-2 border-b border-gray-800">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-600">
              {available.length === 0 ? 'All students are enrolled.' : 'No matches.'}
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.userId}
                onClick={() => add(s.userId)}
                disabled={adding === s.userId}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-200">{s.name || <span className="italic text-gray-500">No name</span>}</div>
                  <div className="text-xs text-gray-500">{s.email}</div>
                </div>
                {adding === s.userId && <span className="text-xs text-gray-500">Adding…</span>}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-gray-800 p-2">
          <button onClick={() => { setOpen(false); setSearch('') }} className="w-full text-xs text-gray-500 hover:text-gray-300 py-1">
            Close
          </button>
        </div>
      </div>
      {/* Click-outside overlay */}
      <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch('') }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function ClassDetailClient({
  classId,
  className,
  description,
  schedules,
  students,
  availableStudents,
}: {
  classId: string
  className: string
  description: string | null
  schedules: ClassSchedule[]
  students: Student[]
  availableStudents: AvailableStudent[]
}) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(className)
  const [savingName, setSavingName] = useState(false)

  async function deleteSlot(id: string) {
    await fetch(`/api/admin/schedules?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function removeStudent(userId: string) {
    setRemoving(userId)
    await fetch(`/api/admin/classes/${classId}/members?userId=${userId}`, { method: 'DELETE' })
    router.refresh()
    setRemoving(null)
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    await fetch(`/api/admin/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSavingName(false)
    setEditingName(false)
    router.refresh()
  }

  const paidCount = students.filter((s) => s.paidCount > 0).length
  const unpaidCount = students.filter((s) => s.unpaidCount > 0).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Class name */}
      <div>
        {editingName ? (
          <form onSubmit={saveName} className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-lg font-semibold text-gray-100 focus:border-violet-500 focus:outline-none"
            />
            <button type="submit" disabled={savingName} className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50">
              {savingName ? '…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setEditingName(false); setName(className) }} className="text-sm text-gray-500 hover:text-gray-300">
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-100">{className}</h2>
            <button onClick={() => setEditingName(true)} className="text-gray-600 hover:text-gray-300 transition-colors" title="Rename class">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        )}
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
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
            <SlotRow key={s.id} slot={s} onDelete={deleteSlot} />
          ))}
          {schedules.length === 0 && (
            <p className="text-sm text-gray-600">No time slots yet.</p>
          )}
        </div>
        <AddSlotRow classId={classId} />
      </div>

      {/* Students */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-300">Students ({students.length})</h3>
          <div className="relative">
            <AddStudentRow classId={classId} available={availableStudents} />
          </div>
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
                <th className="px-4 py-2.5" />
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeStudent(s.userId)}
                      disabled={removing === s.userId}
                      className="rounded bg-red-950 border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
                    >
                      {removing === s.userId ? '…' : 'Remove'}
                    </button>
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
