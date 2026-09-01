import { db } from '@/lib/db/client'
import { studentProfiles, userRoles } from '@/lib/db/schema'
import { getUserRoles, roleIdByName } from '@/lib/auth/permissions'

// Every non-admin, non-teacher sign-in is a student by default. Originally
// app/auth/callback/route.ts, which ran this after Supabase's PKCE exchange;
// then a private function in lib/auth/index.ts. It lives here so it can be
// tested directly — reaching it through the Better Auth hooks meant a real
// OAuth round-trip, so its two load-bearing properties went unverified.
//
// Both properties must survive any change to this file:
//
//   * idempotent — the session.create hook calls it on EVERY sign-in, not
//     just the first, and it must never clobber an admin's edits to an
//     existing profile or duplicate a role grant;
//
//   * never throws — a failure here must not block someone signing in. That
//     matters more now that a role grant is involved: on a database where
//     drizzle/0004_student_role.sql has not been applied, roleIdByName
//     returns null and this degrades to "profile created, no role granted"
//     rather than locking everyone out of the login page.
//
// The profile and the role go in one transaction so an account can't end up
// with one and not the other.
export async function ensureStudentDefaults(userId: string, name: string): Promise<void> {
  try {
    const roleNames = await getUserRoles(userId)
    if (roleNames.includes('admin') || roleNames.includes('teacher')) return

    const studentRoleId = await roleIdByName('student')

    await db.transaction(async (tx) => {
      await tx
        .insert(studentProfiles)
        .values({ userId, fullName: name })
        .onConflictDoNothing({ target: studentProfiles.userId })

      // grantedBy stays null on purpose: that is what distinguishes a grant
      // made by this hook from one an admin made through /staff/users.
      if (studentRoleId) {
        await tx
          .insert(userRoles)
          .values({ userId, roleId: studentRoleId })
          .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
      }
    })
  } catch (err) {
    console.error('ensureStudentDefaults failed:', err)
  }
}
