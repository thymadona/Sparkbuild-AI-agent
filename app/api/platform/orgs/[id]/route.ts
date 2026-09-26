import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { organizations } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { requirePlatformAdmin } from '@/lib/platform-orgs'

// Suspends or reactivates an org. Suspending pauses every member at their
// next request (getSessionUser, proxy.ts); nothing is deleted, so
// reactivating restores them as they were. Direct is never suspended.
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const user = await requirePlatformAdmin()
  if (user instanceof NextResponse) return user
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status } = (await req.json().catch(() => ({}))) as { status?: unknown }
  if (status !== 'active' && status !== 'suspended')
    return NextResponse.json({ error: 'status must be active or suspended' }, { status: 400 })
  if (params.id === DIRECT_ORG_ID)
    return NextResponse.json({ error: 'SparkBuild Direct cannot be suspended' }, { status: 400 })

  try {
    const [row] = await db
      .update(organizations)
      .set({ status })
      .where(eq(organizations.id, params.id))
      .returning({ id: organizations.id, status: organizations.status })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (err) {
    console.error('PATCH /api/platform/orgs/[id] failed:', err)
    return NextResponse.json({ error: 'Could not update the org' }, { status: 500 })
  }
}
