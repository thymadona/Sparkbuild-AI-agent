import { supabaseAdmin } from '@/lib/supabase-server'
import StudentsClient from './StudentsClient'
import type { Class } from '@/types'

export default async function StudentsPage() {
  const [
    { data: usersData },
    { data: profiles },
    { data: members },
    { data: classes },
    { data: invoices },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('student_profiles').select('*'),
    supabaseAdmin.from('class_members').select('user_id, class_id, classes(name)'),
    supabaseAdmin.from('classes').select('id, name, description, created_at').order('name'),
    supabaseAdmin.from('invoices').select('user_id, status'),
  ])

  const users = usersData?.users ?? []
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]))

  const classMap: Record<string, string[]> = {}
  for (const m of members ?? []) {
    const raw = m as unknown as { user_id: string; classes: { name: string } | { name: string }[] | null }
    const name = Array.isArray(raw.classes) ? raw.classes[0]?.name : raw.classes?.name
    if (!classMap[raw.user_id]) classMap[raw.user_id] = []
    if (name) classMap[raw.user_id].push(name)
  }

  const paymentMap: Record<string, { paid: number; unpaid: number }> = {}
  for (const inv of invoices ?? []) {
    if (!paymentMap[inv.user_id]) paymentMap[inv.user_id] = { paid: 0, unpaid: 0 }
    if (inv.status === 'paid') paymentMap[inv.user_id].paid++
    else if (inv.status === 'unpaid') paymentMap[inv.user_id].unpaid++
  }

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email ?? u.id,
    name: profileMap[u.id]?.full_name || (u.user_metadata?.full_name as string) || '',
    isActive: profileMap[u.id]?.is_active ?? true,
    hasProfile: !!profileMap[u.id],
    parentEmail: profileMap[u.id]?.parent_email ?? '',
    parentTelegramChatId: profileMap[u.id]?.parent_telegram_chat_id ?? '',
    notes: profileMap[u.id]?.notes ?? '',
    classes: classMap[u.id] ?? [],
    payment: paymentMap[u.id] ?? null,
    createdAt: u.created_at,
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-100">Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage accounts, classes, and invoices</p>
      </div>
      <StudentsClient rows={rows} classes={(classes ?? []) as Class[]} />
    </div>
  )
}
