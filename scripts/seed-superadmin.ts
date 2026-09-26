import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { roles, userRoles, users } from '@/lib/db/schema'
import { DIRECT_ORG_ID } from '@/lib/orgs'

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
// "Superadmin" means two grants: the org-less `platform_admin` role, which
// marks the platform owner and opens /console (it grants nothing inside an
// org), and `admin` of SparkBuild Direct, which is what opens /staff.
// platform_admin is granted only here, never from /staff/users.
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

  const roleRows = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(inArray(roles.name, ['admin', 'platform_admin']))
  const adminRoleId = roleRows.find((r) => r.name === 'admin')?.id
  const platformRoleId = roleRows.find((r) => r.name === 'platform_admin')?.id
  if (!adminRoleId || !platformRoleId) {
    throw new Error(
      'The "admin" or "platform_admin" role is missing — run `bun run db:migrate` first.'
    )
  }

  const [existing] = await db
    .select({ id: users.id, orgId: users.orgId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  let userId: string
  if (existing) {
    // The admin grant is a Direct grant, and a grant lives in its user's org.
    // Moving someone between orgs is not this script's call.
    if (existing.orgId !== DIRECT_ORG_ID) {
      throw new Error(`${email} belongs to another org, not SparkBuild Direct — not promoting it.`)
    }
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

  const [platform, admin] = await db.transaction(async (tx) => [
    await tx
      .insert(userRoles)
      .values({ userId, roleId: platformRoleId, orgId: null })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
      .returning({ user_id: userRoles.userId }),
    await tx
      .insert(userRoles)
      .values({ userId, roleId: adminRoleId, orgId: DIRECT_ORG_ID })
      .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
      .returning({ user_id: userRoles.userId }),
  ])

  console.log(
    platform.length > 0
      ? `granted the platform_admin role to ${email}`
      : `${email} already held the platform_admin role`
  )
  console.log(
    admin.length > 0
      ? `granted the SparkBuild Direct admin role to ${email}`
      : `${email} already held the SparkBuild Direct admin role`
  )
  console.log(`\nDone. Sign in at /login with Google using ${email} to claim the account.`)
}

async function main(): Promise<void> {
  try {
    await seedSuperadmin()
  } finally {
    await db.$client.end()
  }
}

// A function rather than top-level await: Jest compiles this file to CommonJS
// when the integration test imports seedSuperadmin.
if (process.argv[1]?.endsWith('seed-superadmin.ts')) void main()
