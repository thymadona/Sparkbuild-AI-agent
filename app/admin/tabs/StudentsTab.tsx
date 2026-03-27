import { supabaseAdmin } from '@/lib/supabase-server'
import DeactivateToggle from '@/components/admin/DeactivateToggle'
import CreateStudentModal from '@/components/admin/CreateStudentModal'
import AddToClassModal from '@/components/admin/AddToClassModal'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import type { Class } from '@/types'

export default async function StudentsTab() {
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

  // Map user_id → class names
  const classMap: Record<string, string[]> = {}
  for (const m of members ?? []) {
    const raw = m as unknown as { user_id: string; class_id: string; classes: { name: string } | { name: string }[] | null }
    const name = Array.isArray(raw.classes) ? raw.classes[0]?.name : raw.classes?.name
    if (!classMap[raw.user_id]) classMap[raw.user_id] = []
    if (name) classMap[raw.user_id].push(name)
  }

  // Map user_id → latest payment status
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
    classes: classMap[u.id] ?? [],
    payment: paymentMap[u.id] ?? null,
    createdAt: u.created_at,
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rows.length} students</p>
        <CreateStudentModal />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Name</th>
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Class</th>
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Payment</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Joined</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Active</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id} className={i < rows.length - 1 ? 'border-b border-gray-800' : ''}>
                <td className="px-4 py-3 font-medium">
                  {u.name || <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.classes.length > 0
                      ? u.classes.map((c) => (
                          <span key={c} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{c}</span>
                        ))
                      : <span className="text-gray-600 text-xs">—</span>
                    }
                    {u.hasProfile && (
                      <AddToClassModal
                        userId={u.id}
                        studentName={u.name || u.email}
                        classes={(classes ?? []) as Class[]}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.payment ? (
                    <div className="flex gap-1.5 text-xs">
                      {u.payment.unpaid > 0 && (
                        <span className="rounded bg-red-950 border border-red-800 px-2 py-0.5 text-red-300">
                          {u.payment.unpaid} unpaid
                        </span>
                      )}
                      {u.payment.paid > 0 && (
                        <span className="rounded bg-green-950 border border-green-800 px-2 py-0.5 text-green-300">
                          {u.payment.paid} paid
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.hasProfile ? (
                    <div className="flex justify-end">
                      <DeactivateToggle userId={u.id} initialActive={u.isActive} />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.hasProfile && (
                    <CreateInvoiceModal userId={u.id} studentName={u.name || u.email} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-600">No students yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
