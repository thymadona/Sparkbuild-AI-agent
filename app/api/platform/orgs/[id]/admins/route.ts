import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizations } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { addPersonToOrg, normalizeEmail } from '@/lib/org-people'
import {
  CONFLICT_MESSAGE,
  PersonConflict,
  personResponse,
  requirePlatformAdmin,
} from '@/lib/platform-orgs'

// Names another admin for an org by email: a new email is pre-provisioned as
// that org's admin, a Direct account gets an invite it must accept.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await requirePlatformAdmin()
  if (user instanceof NextResponse) return user
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const email = normalizeEmail(body.email)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!email) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })

  try {
    const result = await db.transaction(async (tx) => {
      const [org] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, params.id))
        .limit(1)
      if (!org) return null

      const person = await addPersonToOrg(tx, {
        orgId: org.id,
        email,
        name: name || email,
        role: 'admin',
        invitedBy: user.id,
      })
      if (person.kind === 'conflict') throw new PersonConflict()
      return personResponse(person)
    })

    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PersonConflict)
      return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 })
    console.error('POST /api/platform/orgs/[id]/admins failed:', err)
    return NextResponse.json({ error: 'Could not add the admin' }, { status: 500 })
  }
}
