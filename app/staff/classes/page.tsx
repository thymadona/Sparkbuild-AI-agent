import { redirect } from 'next/navigation'
import { and, asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classMembers, classes as classesTable } from '@/lib/db/schema'
import { hasPermission, isAdmin, getTeacherClassIds } from '@/lib/auth/permissions'
import { usersInOrg } from '@/lib/orgs'
import ClassesClient from './ClassesClient'
import TeacherClassesClient from './TeacherClassesClient'
import { loadClasses } from './classes-data'
import { getSessionUser } from '@/lib/auth/session'

// Two structurally different views live at one URL: someone who can
// manage all classes gets the full admin roster/schedule/billing table;
// a teacher with no broader permission gets the scoped "classes I teach"
// list they'd get at the old /teacher route. Neither branch is exposed to
// a user who qualifies for the other, so each still needs its own check —
// this isn't just a nav-visibility split.
export default async function ClassesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const canManageAll = (await isAdmin(user.id)) || (await hasPermission(user.id, 'classes:manage'))

  if (canManageAll) {
    const { rows, allTeachers, allStudents } = await loadClasses(user.orgId)

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Classes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Filter by day, view schedules, and open class details
          </p>
        </div>
        <ClassesClient classes={rows} allTeachers={allTeachers} allStudents={allStudents} />
      </div>
    )
  }

  const classIds = await getTeacherClassIds(user.id)
  if (classIds.length === 0) redirect('/staff')

  const [classes, members] = await Promise.all([
    db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        description: classesTable.description,
      })
      .from(classesTable)
      .where(inArray(classesTable.id, classIds))
      .orderBy(asc(classesTable.name)),
    db
      .select({
        class_id: classMembers.classId,
        user_id: classMembers.userId,
        role: classMembers.role,
      })
      .from(classMembers)
      .where(
        and(
          inArray(classMembers.classId, classIds),
          inArray(classMembers.userId, usersInOrg(user.orgId))
        )
      ),
  ])

  const studentIdsByClass: Record<string, string[]> = {}
  for (const m of members) {
    if (m.role !== 'student') continue
    if (!studentIdsByClass[m.class_id]) studentIdsByClass[m.class_id] = []
    studentIdsByClass[m.class_id].push(m.user_id)
  }

  const rows = classes.map((cls) => ({
    id: cls.id,
    name: cls.name,
    description: cls.description,
    studentCount: (studentIdsByClass[cls.id] ?? []).length,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Your classes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Rosters and class management, scoped to classes you teach.
        </p>
      </div>
      <TeacherClassesClient classes={rows} />
    </div>
  )
}
