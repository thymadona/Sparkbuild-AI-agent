import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { hasPermission } from '@/lib/auth/permissions'
import { getSessionUser } from '@/lib/auth/session'
import { addPersonToOrg, permissionForRole, type StaffAddableRole } from '@/lib/org-people'
import { CONFLICT_MESSAGE } from '@/lib/platform-orgs'
import { parsePeopleCsv, type RowError } from '@/lib/people-csv'

// About 500 rows of four columns, with room to spare.
const MAX_CSV_BYTES = 200_000

type Added = { line: number; email: string; status: 'created' | 'granted' | 'invited' }

// Imports students and teachers into the caller's own org from CSV text
// (lib/people-csv.ts has the columns). Bad rows are reported and good rows
// still apply: each row is its own transaction, so a row either lands whole
// (user, role, profile) or not at all, and a failure never undoes another row.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [canStudents, canTeachers] = await Promise.all([
    hasPermission(user.id, permissionForRole('student')),
    hasPermission(user.id, permissionForRole('teacher')),
  ])
  if (!canStudents && !canTeachers)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const may: Record<StaffAddableRole, boolean> = { student: canStudents, teacher: canTeachers }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.csv !== 'string')
    return NextResponse.json({ error: 'Send the file as csv text' }, { status: 400 })
  if (body.csv.length > MAX_CSV_BYTES)
    return NextResponse.json({ error: 'That file is too big' }, { status: 400 })

  const parsed = parsePeopleCsv(body.csv)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const added: Added[] = []
  const failed: RowError[] = [...parsed.errors]

  for (const row of parsed.rows) {
    const fail = (reason: string) => failed.push({ line: row.line, email: row.email, reason })
    if (!may[row.role]) {
      fail(`You can't add ${row.role}s`)
      continue
    }
    try {
      const result = await db.transaction((tx) =>
        addPersonToOrg(tx, {
          orgId: user.orgId,
          email: row.email,
          name: row.name,
          role: row.role,
          invitedBy: user.id,
          parentEmail: row.parentEmail,
        })
      )
      if (result.kind === 'conflict') fail(CONFLICT_MESSAGE)
      else added.push({ line: row.line, email: row.email, status: result.kind })
    } catch (err) {
      console.error(`POST /api/admin/people/import line ${row.line} failed:`, err)
      fail('Could not be added')
    }
  }

  failed.sort((a, b) => a.line - b.line)
  return NextResponse.json({ added, failed })
}
