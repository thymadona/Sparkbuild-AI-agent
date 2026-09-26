import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { organizations } from '@/lib/db/schema'
import { addPersonToOrg, normalizeEmail } from '@/lib/org-people'
import {
  CONFLICT_MESSAGE,
  PersonConflict,
  personResponse,
  requirePlatformAdmin,
  validSlug,
} from '@/lib/platform-orgs'

// Creates a school and names its first admin, all or nothing: an admin email
// that can't join (it belongs to another school) leaves no org behind.
export async function POST(req: Request) {
  const user = await requirePlatformAdmin()
  if (user instanceof NextResponse) return user

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const adminEmail = normalizeEmail(body.adminEmail)
  const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : ''

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!validSlug(slug))
    return NextResponse.json(
      { error: 'Slug must be lowercase letters, digits and dashes, and not a reserved word' },
      { status: 400 }
    )
  if (!adminEmail)
    return NextResponse.json({ error: 'A valid admin email is required' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name, slug })
        .onConflictDoNothing({ target: organizations.slug })
        .returning({ id: organizations.id })
      if (!org) return null

      const person = await addPersonToOrg(tx, {
        orgId: org.id,
        email: adminEmail,
        name: adminName || adminEmail,
        role: 'admin',
        invitedBy: user.id,
      })
      if (person.kind === 'conflict') throw new PersonConflict()
      return { orgId: org.id, admin: personResponse(person) }
    })

    if (!result) return NextResponse.json({ error: 'That slug is taken' }, { status: 409 })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PersonConflict)
      return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 })
    console.error('POST /api/platform/orgs failed:', err)
    return NextResponse.json({ error: 'Could not create the org' }, { status: 500 })
  }
}
