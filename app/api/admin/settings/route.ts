import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { userBuildMode } from '@/lib/db/schema'
import { isUuid } from '@/lib/db/uuid'
import { hasPermission } from '@/lib/auth/permissions'
import { invalidate } from '@/lib/cache'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(req: Request) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await hasPermission(user.id, 'students:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, buildModeEnabled } = await req.json() as { userId: string; buildModeEnabled: boolean }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (!isUuid(userId)) {
    return NextResponse.json({ error: 'userId is not a valid id' }, { status: 400 })
  }

  const updatedAt = new Date().toISOString()

  try {
    await db
      .insert(userBuildMode)
      .values({ userId, enabled: buildModeEnabled, updatedAt })
      .onConflictDoUpdate({
        target: userBuildMode.userId,
        set: { enabled: buildModeEnabled, updatedAt },
      })
  } catch (err) {
    console.error('POST /api/admin/settings failed:', err)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }

  await invalidate(`build-mode:${userId}`)

  return NextResponse.json({ ok: true })
}
