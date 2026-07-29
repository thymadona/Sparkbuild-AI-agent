import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-server'
import ClassDetailClient from './ClassDetailClient'
import type { ClassSchedule } from '@/types'

export default async function ClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [
    { data: cls },
    { data: members },
    { data: schedules },
    { data: invoices },
    { data: usersData },
    { data: profiles },
  ] = await Promise.all([
    supabaseAdmin.from('classes').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('class_members').select('user_id').eq('class_id', params.id),
    supabaseAdmin.from('class_schedules').select('*').eq('class_id', params.id).order('day_of_week').order('start_time'),
    supabaseAdmin.from('invoices').select('user_id, status'),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('student_profiles').select('user_id, full_name'),
  ])

  if (!cls) notFound()

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.full_name]))
  const userMap = Object.fromEntries(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? ''])
  )

  // Payment counts per user (only for members of this class)
  const paymentMap: Record<string, { paid: number; unpaid: number }> = {}
  for (const inv of invoices ?? []) {
    if (!memberIds.has(inv.user_id)) continue
    if (!paymentMap[inv.user_id]) paymentMap[inv.user_id] = { paid: 0, unpaid: 0 }
    if (inv.status === 'paid') paymentMap[inv.user_id].paid++
    else if (inv.status === 'unpaid') paymentMap[inv.user_id].unpaid++
  }

  const students = Array.from(memberIds).map((userId) => ({
    userId,
    name: profileMap[userId] ?? '',
    email: userMap[userId] ?? userId.slice(0, 8),
    paidCount: paymentMap[userId]?.paid ?? 0,
    unpaidCount: paymentMap[userId]?.unpaid ?? 0,
  })).sort((a, b) => a.name.localeCompare(b.name))

  // All students not already enrolled (have a profile)
  const availableStudents = (profiles ?? [])
    .filter((p) => !memberIds.has(p.user_id))
    .map((p) => ({ userId: p.user_id, name: p.full_name, email: userMap[p.user_id] ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/classes" className="hover:text-gray-300 transition-colors">Classes</Link>
        <span>/</span>
        <span className="text-gray-300">{cls.name}</span>
      </div>

      <ClassDetailClient
        classId={cls.id}
        className={cls.name}
        description={cls.description}
        schedules={(schedules ?? []) as ClassSchedule[]}
        students={students}
        availableStudents={availableStudents}
      />
    </div>
  )
}
