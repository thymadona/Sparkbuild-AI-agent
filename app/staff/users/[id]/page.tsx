import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { GraduationCapIcon } from 'lucide-react'
import PageHeader from '@/components/dashboard/PageHeader'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent } from '@/components/ui/card'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { formatDate } from '@/lib/format'
import RoleBadge from '@/components/dashboard/RoleBadge'
import { loadUser } from '../users-data'
import RoleToggles from './RoleToggles'

export default async function UserPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const caller = await getSessionUser()
  if (!caller || !(await hasPermission(caller.id, 'roles:manage'))) redirect('/staff')

  const user = await loadUser(caller.orgId, id)
  if (!user) notFound()

  const canOpenStudent = user.hasProfile && (await hasPermission(caller.id, 'students:manage'))

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/staff/users"
        title={user.fullName || user.email}
        description={user.fullName ? user.email : undefined}
        actions={
          canOpenStudent && (
            <Link
              href={`/staff/students/${user.id}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <GraduationCapIcon />
              Student page
            </Link>
          )
        }
      />

      <Card>
        <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Email</span>
            <p className="mt-0.5 break-all text-foreground">{user.email}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Joined</span>
            <p className="mt-0.5 text-foreground">{formatDate(user.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Current roles</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {user.roles.length === 0 ? (
                <span className="text-muted-foreground/70">None</span>
              ) : (
                user.roles.map((r) => <RoleBadge key={r} role={r} />)
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Staff access</h2>
        <RoleToggles userId={user.id} roles={user.roles} />
      </section>
    </div>
  )
}
