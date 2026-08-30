import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { userBuildMode } from '@/lib/db/schema'
import { getSessionUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ buildModeEnabled: false })
  }

  // Fails closed on a database error, as it did before: build mode is a
  // granted capability, so "we don't know" has to mean "not enabled".
  try {
    const [row] = await db
      .select({ enabled: userBuildMode.enabled })
      .from(userBuildMode)
      .where(eq(userBuildMode.userId, user.id))
      .limit(1)

    return NextResponse.json({ buildModeEnabled: row?.enabled === true })
  } catch {
    return NextResponse.json({ buildModeEnabled: false })
  }
}
