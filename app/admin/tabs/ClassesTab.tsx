import { supabaseAdmin } from '@/lib/supabase-server'
import ClassScheduleEditor from '@/components/admin/ClassScheduleEditor'
import CreateClassInline from '@/components/admin/CreateClassInline'
import type { ClassSchedule } from '@/types'

export default async function ClassesTab() {
  const [
    { data: classes },
    { data: members },
    { data: schedules },
    { data: profiles },
  ] = await Promise.all([
    supabaseAdmin.from('classes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('class_members').select('class_id, user_id'),
    supabaseAdmin.from('class_schedules').select('*').order('day_of_week').order('start_time'),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
  ])

  // Build profile lookup map
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))

  // Group members by class
  type MemberRow = { class_id: string; user_id: string }
  const membersByClass: Record<string, MemberRow[]> = {}
  for (const m of (members ?? []) as MemberRow[]) {
    if (!membersByClass[m.class_id]) membersByClass[m.class_id] = []
    membersByClass[m.class_id].push(m)
  }

  // Group schedules by class
  const schedulesByClass: Record<string, ClassSchedule[]> = {}
  for (const s of schedules ?? []) {
    if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
    schedulesByClass[s.class_id].push(s as ClassSchedule)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{(classes ?? []).length} classes</p>
        <CreateClassInline />
      </div>

      {(classes ?? []).length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center text-sm text-gray-600">
          No classes yet. Create one above.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(classes ?? []).map((cls) => {
          const clsMembers = membersByClass[cls.id] ?? []
          const clsSchedules = schedulesByClass[cls.id] ?? []
          return (
            <div key={cls.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-100">{cls.name}</h3>
                  {cls.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{cls.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {clsMembers.length} students
                </span>
              </div>

              {/* Schedule */}
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-gray-500">Schedule</p>
                <ClassScheduleEditor classId={cls.id} schedules={clsSchedules} />
              </div>

              {/* Students */}
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Students</p>
                {clsMembers.length === 0 ? (
                  <p className="text-xs text-gray-600">None enrolled</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {clsMembers.map((m) => (
                      <span key={m.user_id} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                        {profileMap[m.user_id] ?? m.user_id.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
