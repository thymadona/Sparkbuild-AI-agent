import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { roles, userRoles, users } from '@/lib/db/schema'

// Bootstraps the first admin account. Without this there is a chicken-and-egg
// problem: roles are granted from /staff/users, which only an admin can reach.
//
// This is a script rather than a migration on purpose. The archived
// 0010_roles_permissions.sql hardcoded a real person's address into
// version-controlled DDL and looked it up in auth.users; migrations also run
// in CI against a throwaway database, where seeding a real human is wrong.
//
// The account is created without a credential. The named person claims it by
// signing in with Google on the matching address — `email_verified` is set so
// Better Auth's trusted-provider account linking attaches that Google identity
// to this row instead of creating a second user.
//
// "Superadmin" here means the bootstrap holder of the existing `admin` role
// (full platform access), not a new tier above admin — adding a real
// fourth role would mean changing public.is_admin() and the route guards.
//
// Idempotent: safe to re-run, and safe to run against a database where the
// person already signed in.
export async function seedSuperadmin(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
  const name = process.env.SUPERADMIN_NAME?.trim() || 'Superadmin'

  if (!email) {
    throw new Error(
      'SUPERADMIN_EMAIL is not set. Run it inline if you would rather not commit it:\n' +
        '  SUPERADMIN_EMAIL=you@example.com bun run db:seed:admin'
    )
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`SUPERADMIN_EMAIL does not look like an email address: ${email}`)
  }

  const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, 'admin')).limit(1)
  if (!adminRole) {
    throw new Error('The "admin" role is missing — run `bun run db:migrate` first.')
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)

  let userId: string
  if (existing) {
    userId = existing.id
    console.log(`user already exists for ${email} — promoting it`)
  } else {
    const [created] = await db
      .insert(users)
      .values({ name, email, emailVerified: true })
      .returning({ id: users.id })
    userId = created.id
    console.log(`created user ${email}`)
  }

  const granted = await db
    .insert(userRoles)
    .values({ userId, roleId: adminRole.id })
    .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
    .returning({ user_id: userRoles.userId })

  console.log(
    granted.length > 0
      ? `granted the admin role to ${email}`
      : `${email} already held the admin role`
  )
  console.log(`\nDone. Sign in at /login with Google using ${email} to claim the account.`)
}

if (process.argv[1]?.endsWith('seed-superadmin.ts')) {
  await seedSuperadmin()
  await db.$client.end()
}
