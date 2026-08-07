import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/auth/permissions'
import DeactivateToggle from '@/components/admin/DeactivateToggle'
import EditStudentModal from '@/components/admin/EditStudentModal'
import CreateInvoiceModal from '@/components/admin/CreateInvoiceModal'
import AddToClassModal from '@/components/admin/AddToClassModal'
import BuildModeToggle from '@/components/BuildModeToggle'
import type { Class } from '@/types'

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default async function StudentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = params.id

  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller || !(await hasPermission(caller.id, 'students:manage'))) redirect('/staff')

  const [
    { data: userData },
    { data: profile },
    { data: memberships },
    { data: invoices },
    { data: allClasses },
    { count: promptCount },
    { count: projectCount },
    { data: buildMode },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from('student_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin
      .from('class_members')
      .select('class_id, classes(id, name, description)')
      .eq('user_id', userId),
    supabaseAdmin
      .from('invoices')
      .select('*, receipts(id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('classes').select('id, name, description, created_at').order('name'),
    supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin.from('user_build_mode').select('enabled').eq('user_id', userId).maybeSingle(),
  ])

  const user = userData?.user
  if (!user) notFound()

  // Fetch schedules for enrolled classes
  const classIds = (memberships ?? []).map((m) => {
    const raw = m as unknown as { class_id: string; classes: { id: string; name: string; description: string } | null }
    return raw.class_id
  })

  const { data: schedules } = classIds.length > 0
    ? await supabaseAdmin
        .from('class_schedules')
        .select('*')
        .in('class_id', classIds)
        .order('day_of_week')
        .order('start_time')
    : { data: [] }

  const schedulesByClass: Record<string, { day_of_week: number; start_time: string; duration_min: number }[]> = {}
  for (const s of schedules ?? []) {
    if (!schedulesByClass[s.class_id]) schedulesByClass[s.class_id] = []
    schedulesByClass[s.class_id].push(s)
  }

  const enrolledClasses = (memberships ?? []).map((m) => {
    const raw = m as unknown as { class_id: string; classes: { id: string; name: string; description: string } | null }
    return {
      id: raw.class_id,
      name: raw.classes?.name ?? raw.class_id,
      description: raw.classes?.description ?? '',
      schedules: schedulesByClass[raw.class_id] ?? [],
    }
  })

  const enrolledIds = new Set(enrolledClasses.map((c) => c.id))
  const availableClasses = (allClasses ?? []).filter((c) => !enrolledIds.has(c.id)) as Class[]

  const totalPaid = (invoices ?? []).filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_cents, 0)
  const totalUnpaid = (invoices ?? []).filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amount_cents, 0)

  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const lastSign = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Never'

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/staff/students" className="hover:text-gray-300 transition-colors">Students</Link>
        <span>/</span>
        <span className="text-gray-300">{profile?.full_name ?? user.email}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">
            {profile?.full_name || <span className="text-gray-500 italic">No name</span>}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            <DeactivateToggle userId={userId} initialActive={profile.is_active} />
            <EditStudentModal student={{
              userId,
              fullName: profile.full_name,
              parentEmail: profile.parent_email ?? '',
              parentTelegramChatId: profile.parent_telegram_chat_id ?? '',
              notes: profile.notes ?? '',
            }} />
            <CreateInvoiceModal userId={userId} studentName={profile.full_name || (user.email ?? '')} />
          </div>
        )}
      </div>

      {/* Profile info */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        <div className="px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Profile</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">Parent email</span>
              <p className="text-gray-100 mt-0.5">{profile?.parent_email || <span className="text-gray-600">—</span>}</p>
            </div>
            <div>
              <span className="text-gray-500">Telegram chat ID</span>
              <p className="text-gray-100 mt-0.5 font-mono text-xs">{profile?.parent_telegram_chat_id || <span className="text-gray-600">—</span>}</p>
            </div>
            <div>
              <span className="text-gray-500">Joined</span>
              <p className="text-gray-100 mt-0.5">{joinedDate}</p>
            </div>
            <div>
              <span className="text-gray-500">Last sign in</span>
              <p className="text-gray-100 mt-0.5">{lastSign}</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className="mt-0.5">
                {profile ? (
                  <span className={`text-xs font-medium ${profile.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    {profile.is_active ? 'Active' : 'Deactivated'}
                  </span>
                ) : (
                  <span className="text-gray-600 text-xs">No profile</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Auth provider</span>
              <p className="text-gray-100 mt-0.5 capitalize">
                {user.app_metadata?.provider ?? 'email'}
              </p>
            </div>
          </div>
          {profile?.notes && (
            <div className="mt-4">
              <span className="text-gray-500 text-sm">Notes</span>
              <p className="mt-1 text-sm text-gray-300 whitespace-pre-wrap rounded-lg bg-gray-800 px-3 py-2">{profile.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="rounded-xl border border-gray-800 bg-gray-900">
        <div className="px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Activity</p>
          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-gray-500">AI requests</span>
              <p className="text-gray-100 mt-0.5 text-lg font-semibold tabular-nums">{promptCount ?? 0}</p>
            </div>
            <div>
              <span className="text-gray-500">Projects</span>
              <p className="text-gray-100 mt-0.5 text-lg font-semibold tabular-nums">{projectCount ?? 0}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-500">Build mode</span>
              <BuildModeToggle userId={userId} initialEnabled={buildMode?.enabled === true} />
            </div>
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="rounded-xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Classes <span className="text-gray-600 font-normal normal-case ml-1">({enrolledClasses.length})</span>
          </p>
          {profile && (
            <AddToClassModal
              userId={userId}
              studentName={profile.full_name || (user.email ?? '')}
              classes={availableClasses}
            />
          )}
        </div>
        {enrolledClasses.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-600">Not enrolled in any class.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {enrolledClasses.map((cls) => (
              <div key={cls.id} className="px-5 py-3 flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/staff/classes/${cls.id}`}
                    className="text-sm font-medium text-gray-100 hover:text-violet-300 transition-colors"
                  >
                    {cls.name}
                  </Link>
                  {cls.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{cls.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {cls.schedules.length > 0 ? cls.schedules.map((s, i) => (
                      <span key={i} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                        {DAY[s.day_of_week]} {formatTime(s.start_time)} · {s.duration_min}min
                      </span>
                    )) : (
                      <span className="text-xs text-gray-600">No schedule</span>
                    )}
                  </div>
                </div>
                <Link href={`/staff/classes/${cls.id}`} className="text-xs text-gray-600 hover:text-gray-400 shrink-0">
                  Details →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finance summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-red-400 mb-1">Outstanding</div>
          <div className="text-2xl font-bold text-red-300">{formatAmount(totalUnpaid)}</div>
        </div>
        <div className="rounded-xl border border-green-900/50 bg-green-950/30 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-green-400 mb-1">Collected</div>
          <div className="text-2xl font-bold text-green-300">{formatAmount(totalPaid)}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Invoices</div>
          <div className="text-2xl font-bold text-gray-100">{(invoices ?? []).length}</div>
        </div>
      </div>

      {/* Invoices table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invoices</p>
          {profile && (
            <CreateInvoiceModal userId={userId} studentName={profile.full_name || (user.email ?? '')} />
          )}
        </div>
        {(invoices ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-600">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Description</th>
                <th className="text-right px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Amount</th>
                <th className="text-right px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Due</th>
                <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="text-right px-5 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(invoices ?? []).map((inv) => {
                const raw = inv as typeof inv & { receipts: { id: string }[] | { id: string } | null }
                const receiptId = Array.isArray(raw.receipts) ? raw.receipts[0]?.id : (raw.receipts as { id: string } | null)?.id
                const isOverdue = inv.status === 'unpaid' && inv.due_date < today
                return (
                  <tr key={inv.id} className="hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-gray-300 text-xs max-w-xs truncate">{inv.description}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-gray-100">{formatAmount(inv.amount_cents)}</td>
                    <td className={`px-5 py-3 text-right text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                      {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {isOverdue && <span className="ml-1 text-red-500">overdue</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        inv.status === 'paid'
                          ? 'bg-green-950 border border-green-800 text-green-300'
                          : inv.status === 'void'
                          ? 'bg-gray-800 border border-gray-700 text-gray-500'
                          : 'bg-red-950 border border-red-800 text-red-300'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer"
                          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">
                          Invoice
                        </a>
                        {receiptId && (
                          <a href={`/receipt/${receiptId}`} target="_blank" rel="noopener noreferrer"
                            className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-600">
                            Receipt
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
