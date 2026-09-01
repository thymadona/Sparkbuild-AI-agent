import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { studentProfiles, userRoles, users } from '@/lib/db/schema'
import { hasPermission, roleIdByName } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'students:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, parent_email, parent_telegram_chat_id, notes } =
    await req.json() as {
      email: string
      full_name: string
      parent_email?: string
      parent_telegram_chat_id?: string
      notes?: string
    }

  if (!email || !full_name) {
    return NextResponse.json({ error: 'email and full_name are required' }, { status: 400 })
  }

  // Creates the account with no credential. The student claims it by signing
  // in with Google on this address — `email_verified` is what lets Better
  // Auth's trusted-provider linking attach that identity to this row instead
  // of creating a second user (see account.accountLinking in lib/auth/index.ts).
  //
  // One transaction, so a failure partway can't leave an account with no
  // profile — the previous two-step version could, and the orphan was
  // invisible to /staff/students.
  try {
    const studentRoleId = await roleIdByName('student')

    const newUserId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ name: full_name, email: email.trim().toLowerCase(), emailVerified: true })
        .returning({ id: users.id })

      await tx.insert(studentProfiles).values({
        userId: created.id,
        fullName: full_name,
        parentEmail: parent_email ?? null,
        parentTelegramChatId: parent_telegram_chat_id ?? null,
        notes: notes ?? null,
        createdBy: user.id,
      })

      // An admin creating a student is registering one, so grant the role
      // now rather than waiting for their first sign-in — the same grant
      // lib/auth/student-defaults.ts would make. Skipped (not failed) when
      // the role is missing, so provisioning still works on a database that
      // has not had drizzle/0004_student_role.sql applied.
      if (studentRoleId) {
        await tx
          .insert(userRoles)
          .values({ userId: created.id, roleId: studentRoleId, grantedBy: user.id })
          .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
      }

      return created.id
    })

    return NextResponse.json({ userId: newUserId })
  } catch (err) {
    // users.email is unique, so re-adding an existing student lands here.
    const message = String((err as Error)?.message ?? '')
    if (message.includes('users_email_unique') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }
    console.error('POST /api/admin/students failed:', err)
    return NextResponse.json({ error: 'Could not create the student' }, { status: 500 })
  }
}
