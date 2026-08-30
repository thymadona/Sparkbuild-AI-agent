import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { classes } from '@/lib/db/schema'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'

// snake_case keys throughout: `Class` in types/index.ts and the admin client
// components read this shape directly.
const classColumns = {
  id: classes.id,
  name: classes.name,
  description: classes.description,
  created_at: classes.createdAt,
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const rows = await db.select(classColumns).from(classes).orderBy(desc(classes.createdAt))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/admin/classes failed:', err)
    return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasPermission(user.id, 'classes:manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description } = await req.json() as { name: string; description?: string }
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  try {
    const [row] = await db
      .insert(classes)
      .values({ name, description: description ?? null })
      .returning(classColumns)

    return NextResponse.json(row)
  } catch (err) {
    console.error('POST /api/admin/classes failed:', err)
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
  }
}
