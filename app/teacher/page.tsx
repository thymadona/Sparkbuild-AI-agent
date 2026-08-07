import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'
import TeacherDashboardClient from './TeacherDashboardClient'

export default async function TeacherDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await isAdmin(user!.id)
  const classIds = admin
    ? ((await supabaseAdmin.from('classes').select('id')).data ?? []).map((c) => c.id)
    : await getTeacherClassIds(user!.id)

  const noClasses = classIds.length === 0
  const scopedIds = noClasses ? ['00000000-0000-0000-0000-000000000000'] : classIds

  const [{ data: classes }, { data: members }, { data: projects }] = await Promise.all([
    supabaseAdmin.from('classes').select('*').in('id', scopedIds).order('name'),
    supabaseAdmin.from('class_members').select('class_id, user_id, role').in('class_id', scopedIds),
    supabaseAdmin
      .from('projects')
      .select('user_id, submission_status')
      .eq('submission_status', 'submitted'),
  ])

  const studentIdsByClass: Record<string, string[]> = {}
  for (const m of members ?? []) {
    if (m.role !== 'student') continue
    if (!studentIdsByClass[m.class_id]) studentIdsByClass[m.class_id] = []
    studentIdsByClass[m.class_id].push(m.user_id)
  }

  const pendingReviewUserIds = new Set((projects ?? []).map((p) => p.user_id))

  const rows = (classes ?? []).map((cls) => {
    const studentIds = studentIdsByClass[cls.id] ?? []
    return {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      studentCount: studentIds.length,
      pendingReviewCount: studentIds.filter((id) => pendingReviewUserIds.has(id)).length,
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">
          {admin ? 'All classes' : 'Your classes'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Rosters and homework review, scoped to {admin ? 'the whole school' : 'classes you teach'}.
        </p>
      </div>
      <TeacherDashboardClient classes={rows} />
    </div>
  )
}
