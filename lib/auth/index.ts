import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { accounts, sessions, studentProfiles, users, verifications } from '@/lib/db/schema'
import { getUserRoles } from '@/lib/auth/permissions'

// Every non-admin, non-teacher sign-in is a student by default. Ported from
// the old app/auth/callback/route.ts, which ran this after Supabase's PKCE
// exchange. Two properties are load-bearing and must survive:
//   * idempotent — it runs on every sign-in, not just the first, and must
//     never clobber an admin's edits to an existing profile;
//   * never throws — a failure here must not block someone signing in.
async function ensureStudentProfile(userId: string, name: string) {
  try {
    const roleNames = await getUserRoles(userId)
    if (roleNames.includes('admin') || roleNames.includes('teacher')) return

    await db
      .insert(studentProfiles)
      .values({ userId, fullName: name })
      .onConflictDoNothing({ target: studentProfiles.userId })
  } catch (err) {
    console.error('ensureStudentProfile failed:', err)
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    // Better Auth's model names are singular; ours are plural because `user`
    // is a reserved word in Postgres and an unquoted reference to it silently
    // resolves to `current_user`.
    //
    // These keys must be the *resolved* model names — i.e. the `modelName`
    // values set below, not Better Auth's singular defaults. The adapter
    // resolves `user` -> `users` through `modelName` first and only then does
    // `schema[model]`, so keying this map by `user`/`session`/`account`/
    // `verification` makes every lookup miss and throws
    // `The model "users" was not found in the schema object` on the first
    // query of a sign-in.
    schema: { users, sessions, accounts, verifications },
  }),

  // Only `modelName` is overridden. Better Auth resolves each field by its
  // *Drizzle property name* and its own field names are camelCase, which the
  // schema now matches exactly — so the `fields` maps these four models used
  // to carry were identity maps and are gone. Renaming a property in
  // lib/db/schema.ts still breaks the adapter at runtime ("field does not
  // exist in the schema"), and no longer has a map here to remind you.
  user: { modelName: 'users' },
  session: { modelName: 'sessions' },
  account: {
    modelName: 'accounts',
    // Admin-provisioned students (POST /api/admin/students) get a `users` row
    // with no credential and no linked account — they are expected to claim it
    // by signing in with Google on the matching address. Without trusted-provider
    // linking, that first sign-in creates a *second* user instead of linking,
    // which would strand the profile, class membership and invoices attached to
    // the original row. Google is trustworthy here because it reports a real
    // `email_verified` signal.
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },
  verification: { modelName: 'verifications' },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  advanced: {
    // Ids are uuid rather than Better Auth's default text, so that the twelve
    // FK columns pointing at users.id keep their type.
    database: { generateId: () => crypto.randomUUID() },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await ensureStudentProfile(user.id, user.name ?? '')
        },
      },
    },
    session: {
      create: {
        // Also on every sign-in, not just account creation: a profile can be
        // deleted or an account can predate this hook existing.
        after: async (session) => {
          const [row] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, session.userId))
            .limit(1)
          await ensureStudentProfile(session.userId, row?.name ?? '')
        },
      },
    },
  },
})
