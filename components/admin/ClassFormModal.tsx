'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'

export type PersonOption = { userId: string; name: string; email: string }

type SlotForm = { day_of_week: number; start_time: string; duration_min: number; label: string }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ── Schedule row: inline edit / delete a slot (drafted or already saved) ──
function SlotRow({
  slot,
  onDelete,
  onSave,
}: {
  slot: ClassSchedule
  onDelete: (id: string) => void | Promise<void>
  onSave: (id: string, form: SlotForm) => void | Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SlotForm>({
    day_of_week: slot.day_of_week,
    start_time: slot.start_time.slice(0, 5),
    duration_min: slot.duration_min,
    label: slot.label ?? '',
  })

  function set<K extends keyof SlotForm>(key: K, val: SlotForm[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(slot.id, form)
    setSaving(false)
    setEditing(false)
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
        <button type="submit" disabled={saving} className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">
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
        <button onClick={() => setEditing(true)} className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600 transition-colors">
          Edit
        </button>
        <button onClick={() => onDelete(slot.id)} className="rounded px-2 py-0.5 text-xs text-gray-600 hover:text-red-400 transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Add a new schedule slot (drafted locally or saved immediately) ───────
function AddSlotRow({ onAdd }: { onAdd: (form: SlotForm) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SlotForm>({ day_of_week: 1, start_time: '09:00', duration_min: 60, label: '' })

  function set<K extends keyof SlotForm>(key: K, val: SlotForm[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onAdd(form)
    setSaving(false)
    setOpen(false)
    setForm({ day_of_week: 1, start_time: '09:00', duration_min: 60, label: '' })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
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
      <button type="submit" disabled={saving} className="rounded bg-violet-600 px-2.5 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50">
        {saving ? '…' : 'Add'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">
        Cancel
      </button>
    </form>
  )
}

// ── Assigned person row with a remove button ────────────────────────────
function PersonRow({ person, removing, onRemove }: { person: PersonOption; removing: boolean; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-800 px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-gray-200">{person.name || <span className="italic text-gray-500">No name</span>}</div>
        <div className="text-xs text-gray-500">{person.email}</div>
      </div>
      <button
        onClick={onRemove}
        disabled={removing}
        className="rounded bg-red-950 border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
      >
        {removing ? '…' : 'Remove'}
      </button>
    </div>
  )
}

// ── Search + add from a pool of people ──────────────────────────────────
function AddPersonRow({
  pool,
  label,
  emptyLabel,
  onAdd,
}: {
  pool: PersonOption[]
  label: string
  emptyLabel: string
  onAdd: (person: PersonOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = pool.filter((p) => {
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors">
        + {label}
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
            placeholder="Search…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-600">{pool.length === 0 ? emptyLabel : 'No matches.'}</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.userId}
                onClick={() => { onAdd(p); setOpen(false); setSearch('') }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-800 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-gray-200">{p.name || <span className="italic text-gray-500">No name</span>}</div>
                  <div className="text-xs text-gray-500">{p.email}</div>
                </div>
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
      <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch('') }} />
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────
type Props =
  | {
      mode: 'create'
      allTeachers: PersonOption[]
      allStudents: PersonOption[]
    }
  | {
      mode: 'edit'
      classId: string
      initialName: string
      initialDescription: string | null
      initialSchedules: ClassSchedule[]
      initialTeachers: PersonOption[]
      initialStudents: PersonOption[]
      allTeachers: PersonOption[]
      allStudents: PersonOption[]
      trigger?: React.ReactNode
    }

export default function ClassFormModal(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const classId = isEdit ? props.classId : null

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(isEdit ? props.initialName : '')
  const [description, setDescription] = useState(isEdit ? props.initialDescription ?? '' : '')
  const [schedules, setSchedules] = useState<ClassSchedule[]>(isEdit ? props.initialSchedules : [])
  const [teachers, setTeachers] = useState<PersonOption[]>(isEdit ? props.initialTeachers : [])
  const [students, setStudents] = useState<PersonOption[]>(isEdit ? props.initialStudents : [])
  const [savingHeader, setSavingHeader] = useState(false)
  const [creating, setCreating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const teacherIds = new Set(teachers.map((t) => t.userId))
  const studentIds = new Set(students.map((s) => s.userId))
  const teacherPool = props.allTeachers.filter((t) => !teacherIds.has(t.userId))
  const studentPool = props.allStudents.filter((s) => !studentIds.has(s.userId))

  function reset() {
    setError('')
    if (!isEdit) {
      setName('')
      setDescription('')
      setSchedules([])
      setTeachers([])
      setStudents([])
    }
  }

  function close() {
    setOpen(false)
    reset()
    if (isEdit) router.refresh()
  }

  async function saveHeader() {
    if (!classId || !name.trim()) return
    setSavingHeader(true)
    await fetch(`/api/admin/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    })
    setSavingHeader(false)
    router.refresh()
  }

  // In create mode the class doesn't exist yet, so every add/remove/edit
  // below is a pure local draft — nothing hits the API until "Create Class"
  // fires them all at once. In edit mode the class already exists, so each
  // action persists immediately, same as it always has.
  async function addTeacher(person: PersonOption) {
    setTeachers((t) => [...t, person])
    if (!classId) return
    await fetch(`/api/admin/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: person.userId, role: 'teacher' }),
    })
  }

  async function addStudent(person: PersonOption) {
    setStudents((s) => [...s, person])
    if (!classId) return
    await fetch(`/api/admin/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: person.userId, role: 'student' }),
    })
  }

  async function removeMember(userId: string, listSetter: React.Dispatch<React.SetStateAction<PersonOption[]>>) {
    setRemovingId(userId)
    listSetter((list) => list.filter((p) => p.userId !== userId))
    if (classId) {
      await fetch(`/api/admin/classes/${classId}/members?userId=${userId}`, { method: 'DELETE' })
    }
    setRemovingId(null)
  }

  async function addSlot(form: SlotForm) {
    if (classId) {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId, ...form }),
      })
      const data = await res.json() as ClassSchedule
      if (res.ok) setSchedules((s) => [...s, data])
    } else {
      setSchedules((s) => [...s, { id: `draft:${s.length}:${Date.now()}`, class_id: '', ...form, label: form.label || null }])
    }
  }

  async function deleteSlot(id: string) {
    setSchedules((s) => s.filter((slot) => slot.id !== id))
    if (classId && !id.startsWith('draft:')) {
      await fetch(`/api/admin/schedules?id=${id}`, { method: 'DELETE' })
    }
  }

  async function saveSlot(id: string, form: SlotForm) {
    setSchedules((list) => list.map((s) => (s.id === id ? { ...s, ...form, label: form.label || null } : s)))
    if (classId && !id.startsWith('draft:')) {
      await fetch(`/api/admin/schedules?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
  }

  async function createClass() {
    if (!name.trim()) return
    setCreating(true)
    setError('')

    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    })
    const data = await res.json() as { id?: string; error?: string }
    if (!res.ok || !data.id) {
      setCreating(false)
      setError(data.error ?? 'Failed to create class')
      return
    }
    const newClassId = data.id

    await Promise.all([
      ...schedules.map((s) =>
        fetch('/api/admin/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            class_id: newClassId,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            duration_min: s.duration_min,
            label: s.label ?? undefined,
          }),
        })
      ),
      ...teachers.map((t) =>
        fetch(`/api/admin/classes/${newClassId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: t.userId, role: 'teacher' }),
        })
      ),
      ...students.map((s) =>
        fetch(`/api/admin/classes/${newClassId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: s.userId, role: 'student' }),
        })
      ),
    ])

    setCreating(false)
    setOpen(false)
    reset()
    router.push(`/staff/classes/${newClassId}`)
  }

  const trigger = isEdit
    ? (props.trigger ?? (
        <button className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors">
          Edit class
        </button>
      ))
    : (
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New Class
        </button>
      )

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">{isEdit ? 'Edit Class' : 'New Class'}</h2>
              <button onClick={close} className="text-gray-500 hover:text-gray-300 text-sm">
                Close
              </button>
            </div>

            {error && (
              <p className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">{error}</p>
            )}

            {/* Name + description */}
            <div className="space-y-2">
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Class name"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />
              {isEdit && (
                <button
                  type="button"
                  onClick={saveHeader}
                  disabled={savingHeader || !name.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingHeader ? '…' : 'Save'}
                </button>
              )}
            </div>

            {/* Teachers */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/40">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-300">Teacher ({teachers.length})</h3>
                <AddPersonRow pool={teacherPool} label="Add Teacher" emptyLabel="No platform teachers available — grant the teacher role from People & Roles first." onAdd={addTeacher} />
              </div>
              <div className="p-3 space-y-2">
                {teachers.length === 0 ? (
                  <p className="text-center text-sm text-gray-600 py-3">No teacher assigned yet.</p>
                ) : (
                  teachers.map((t) => (
                    <PersonRow key={t.userId} person={t} removing={removingId === t.userId} onRemove={() => removeMember(t.userId, setTeachers)} />
                  ))
                )}
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-300">Weekly Schedule</h3>
              <div className="space-y-2">
                {schedules.map((s) => (
                  <SlotRow key={s.id} slot={s} onDelete={deleteSlot} onSave={saveSlot} />
                ))}
                {schedules.length === 0 && <p className="text-sm text-gray-600">No time slots yet.</p>}
              </div>
              <AddSlotRow onAdd={addSlot} />
            </div>

            {/* Students */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/40">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-300">Students ({students.length})</h3>
                <AddPersonRow pool={studentPool} label="Add Student" emptyLabel="All students are enrolled." onAdd={addStudent} />
              </div>
              <div className="p-3 space-y-2">
                {students.length === 0 ? (
                  <p className="text-center text-sm text-gray-600 py-3">No students enrolled yet.</p>
                ) : (
                  students.map((s) => (
                    <PersonRow key={s.userId} person={s} removing={removingId === s.userId} onRemove={() => removeMember(s.userId, setStudents)} />
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-800 pt-4">
              {isEdit ? (
                <button onClick={close} className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600">
                  Done
                </button>
              ) : (
                <>
                  <button onClick={close} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                    Cancel
                  </button>
                  <button
                    onClick={createClass}
                    disabled={creating || !name.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create Class'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
