import { supabaseAdmin } from '@/lib/supabase-server'
import ClassesClient from './ClassesClient'

export default async function ClassesPage() {
  const [
    { data: classes },
    { data: members },
    { data: schedules },
    { data: invoices },
  ] = await Promise.all([
    supabaseAdmin.from('classes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('class_members').select('class_id, user_id'),
    supabaseAdmin.from('class_schedules').select('*').order('day_of_week').order('start_time'),
    supabaseAdmin.from('invoices').select('user_id, status'),
  ])

  // Members per class
  const membersByClass: Record<string, string[]> = {}
  for (const m of members ?? []) {
    if (!membersByClass[m.class_id]) membersByClass[m.class_id] = []
    membersByClass[m.class_id].push(m.user_id)
  }

  // Schedules per class
  const schedulesByClass: Record<string, { day_of_week: number; start_time: string; duration_min: number }[]> = {}
  for (const s of schedules ?? []) {
    if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
    schedulesByClass[s.class_id].push({ day_of_week: s.day_of_week, start_time: s.start_time, duration_min: s.duration_min })
  }

  // Payment counts per user
  const paidUsers = new Set((invoices ?? []).filter((i) => i.status === 'paid').map((i) => i.user_id))
  const unpaidUsers = new Set((invoices ?? []).filter((i) => i.status === 'unpaid').map((i) => i.user_id))

  const rows = (classes ?? []).map((cls) => {
    const userIds = membersByClass[cls.id] ?? []
    return {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      createdAt: cls.created_at,
      studentCount: userIds.length,
      schedules: schedulesByClass[cls.id] ?? [],
      paidCount: userIds.filter((id) => paidUsers.has(id)).length,
      unpaidCount: userIds.filter((id) => unpaidUsers.has(id)).length,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">Filter by day, view schedules, and open class details</p>
      </div>
      <ClassesClient classes={rows} />
    </div>
  )
}
