import { supabaseAdmin } from '@/lib/supabase-server'
import BuildModeToggle from '@/components/BuildModeToggle'

const INPUT_COST_PER_M = 0.15
const OUTPUT_COST_PER_M = 0.60
const AVG_INPUT_TOKENS = 2000
const AVG_OUTPUT_TOKENS = 3000

function estimateCost(count: number): string {
  const d = count * ((AVG_INPUT_TOKENS * INPUT_COST_PER_M + AVG_OUTPUT_TOKENS * OUTPUT_COST_PER_M) / 1_000_000)
  return d < 0.01 ? '<$0.01' : `$${d.toFixed(2)}`
}

export default async function OverviewTab() {
  const [
    { data: usersData },
    { count: totalPrompts },
    { count: promptsToday },
    { count: totalProjects },
    { data: allPrompts },
    { data: allProjects },
    { data: buildModeRows },
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('prompts').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('prompts').select('user_id'),
    supabaseAdmin.from('projects').select('user_id'),
    supabaseAdmin.from('user_build_mode').select('user_id, enabled'),
  ])

  const users = usersData?.users ?? []
  const safeTotal = totalPrompts ?? 0

  const countByUser: Record<string, number> = {}
  for (const row of allPrompts ?? []) {
    countByUser[row.user_id] = (countByUser[row.user_id] ?? 0) + 1
  }

  const projectCountByUser: Record<string, number> = {}
  for (const row of allProjects ?? []) {
    projectCountByUser[row.user_id] = (projectCountByUser[row.user_id] ?? 0) + 1
  }

  const buildModeByUser: Record<string, boolean> = {}
  for (const row of buildModeRows ?? []) {
    buildModeByUser[row.user_id] = row.enabled === true
  }

  const safeTotalProjects = totalProjects ?? 0
  const avgProjects = users.length > 0 ? (safeTotalProjects / users.length).toFixed(1) : '0'

  const userRows = users
    .map((u) => ({
      id: u.id,
      email: u.email ?? u.id,
      name: (u.user_metadata?.full_name as string) ?? '',
      prompts: countByUser[u.id] ?? 0,
      projects: projectCountByUser[u.id] ?? 0,
      buildMode: buildModeByUser[u.id] ?? false,
      createdAt: u.created_at,
    }))
    .sort((a, b) => b.prompts - a.prompts)

  const stats = [
    { label: 'Total Users', value: users.length },
    { label: 'Total AI Requests', value: safeTotal },
    { label: 'Requests (24h)', value: promptsToday ?? 0 },
    { label: 'Total Projects', value: safeTotalProjects },
    { label: 'Avg Projects / Student', value: avgProjects },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
            <div className="text-gray-500 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-2xl font-bold">{estimateCost(safeTotal)}</div>
        <div className="text-gray-500 text-sm mt-1">
          Estimated all-time cost · {safeTotal.toLocaleString()} requests × ~2K in / 3K out @ Gemini 2.5 Flash pricing
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-normal">Name</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">AI Requests</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Projects</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Joined</th>
              <th className="text-right px-4 py-3 text-gray-500 font-normal">Build Mode</th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((u, i) => (
              <tr key={u.email} className={i < userRows.length - 1 ? 'border-b border-gray-800' : ''}>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 text-gray-400">{u.name || <span className="text-gray-600">—</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.prompts}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.projects}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end">
                    <BuildModeToggle userId={u.id} initialEnabled={u.buildMode} />
                  </div>
                </td>
              </tr>
            ))}
            {userRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-600">No users yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
