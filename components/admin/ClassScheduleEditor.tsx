'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClassSchedule } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ClassScheduleEditor({
  classId,
  schedules,
}: {
  classId: string
  schedules: ClassSchedule[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ day_of_week: 1, start_time: '09:00', duration_min: 60, label: '' })

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function addSlot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/admin/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, ...form }),
    })
    setAdding(false)
    router.refresh()
    setLoading(false)
  }

  async function removeSlot(id: string) {
    await fetch(`/api/admin/schedules?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="mt-2 space-y-1">
      {schedules.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span>
            {DAYS[s.day_of_week]} {s.start_time.slice(0, 5)} · {s.duration_min}min
            {s.label ? ` · ${s.label}` : ''}
          </span>
          <button
            onClick={() => removeSlot(s.id)}
            className="text-gray-600 hover:text-red-400"
            title="Remove slot"
          >
            ×
          </button>
        </div>
      ))}

      {adding ? (
        <form onSubmit={addSlot} className="mt-2 flex flex-wrap items-end gap-2">
          <select
            value={form.day_of_week}
            onChange={(e) => set('day_of_week', Number(e.target.value))}
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
          >
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => set('start_time', e.target.value)}
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
          />
          <input
            type="number"
            min={15}
            max={480}
            value={form.duration_min}
            onChange={(e) => set('duration_min', Number(e.target.value))}
            className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
            placeholder="min"
          />
          <input
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
            className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
            placeholder="Label (opt)"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Add time slot
        </button>
      )}
    </div>
  )
}
