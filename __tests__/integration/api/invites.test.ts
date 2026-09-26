/**
 * The move flow: a signed-in SparkBuild Direct user sees their open invites
 * (/api/invites) and accepts or declines one (/api/invites/[id]/accept,
 * /decline). Accepting moves the account into the school. The session is
 * mocked; the database is real.
 */
const mockGetSessionUser = jest.fn()

jest.mock('@/lib/auth/session', () => ({ getSessionUser: () => mockGetSessionUser() }))

import { eq } from 'drizzle-orm'
import { GET as listMine } from '@/app/api/invites/route'
import { POST as accept } from '@/app/api/invites/[id]/accept/route'
import { POST as decline } from '@/app/api/invites/[id]/decline/route'
import { db } from '@/lib/db/client'
import {
  activityDays,
  classMembers,
  invoices,
  lessonProgress,
  orgInvites,
  projects,
  receipts,
  roles,
  userRoles,
  users,
} from '@/lib/db/schema'
import { LESSONS } from '@/lib/lessons'
import { LAST_ADMIN_MESSAGE, UNPAID_MESSAGE } from '@/lib/org-move'
import { DIRECT_ORG_ID } from '@/lib/orgs'
import { getPlayerStats } from '@/lib/player-stats'
import { todayISO } from '@/lib/xp'
import {
  addClassMember,
  grantRole,
  makeClass,
  makeOrg,
  makeProject,
  makeUser,
  resetDb,
  setLessonProgress,
} from '@/__tests__/helpers/db'

beforeEach(async () => {
  await resetDb()
  mockGetSessionUser.mockReset()
})
afterAll(() => db.$client.end())

type User = Awaited<ReturnType<typeof makeUser>>

const signIn = (user: User) =>
  mockGetSessionUser.mockResolvedValue({ id: user.id, orgId: user.orgId, email: user.email })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const acceptIt = (id: string) => accept(new Request('http://x', { method: 'POST' }), params(id))
const declineIt = (id: string) => decline(new Request('http://x', { method: 'POST' }), params(id))

const reload = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0]
const inviteRow = async (id: string) =>
  (await db.select().from(orgInvites).where(eq(orgInvites.id, id)))[0]

async function grantsOf(userId: string) {
  const rows = await db
    .select({ name: roles.name, orgId: userRoles.orgId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

async function directStudent(email = `kid-${Math.random()}@home.test`) {
  const user = await makeUser({ email })
  await grantRole(user.id, 'student')
  return user
}

async function invite(orgId: string, email: string, role = 'student') {
  const [row] = await db
    .insert(orgInvites)
    .values({ orgId, email: email.toLowerCase(), role })
    .returning()
  return row
}

async function makeInvoice(userId: string, status: 'unpaid' | 'paid' | 'void') {
  const [row] = await db
    .insert(invoices)
    .values({
      userId,
      orgId: DIRECT_ORG_ID,
      amountCents: 1000,
      description: 'Term fee',
      dueDate: '2026-10-01',
      status,
    })
    .returning()
  return row
}

describe('GET /api/invites', () => {
  it('shows a Direct user their invite, matched case-insensitively', async () => {
    const school = await makeOrg({ name: 'River School' })
    const kid = await directStudent('Kid@Home.test')
    const inv = await invite(school.id, 'kid@home.test')
    signIn(kid)

    const body = await (await listMine()).json()
    expect(body.invites).toEqual([
      expect.objectContaining({ id: inv.id, orgName: 'River School', role: 'student' }),
    ])
  })

  it('shows nobody else’s invite, and nothing to a school user', async () => {
    const school = await makeOrg()
    await invite(school.id, 'someone@home.test')
    const kid = await directStudent()
    signIn(kid)
    expect((await (await listMine()).json()).invites).toEqual([])

    const member = await makeUser({ orgId: school.id, email: 'member@school.test' })
    await invite((await makeOrg()).id, 'member@school.test')
    signIn(member)
    expect((await (await listMine()).json()).invites).toEqual([])
  })
})

describe('POST /api/invites/[id]/accept', () => {
  it('refuses a different user, and changes nothing', async () => {
    const school = await makeOrg()
    const owner = await directStudent()
    const inv = await invite(school.id, owner.email)
    const other = await directStudent()
    signIn(other)

    expect((await acceptIt(inv.id)).status).toBe(404)
    expect((await reload(other.id)).orgId).toBe(DIRECT_ORG_ID)
    expect((await reload(owner.id)).orgId).toBe(DIRECT_ORG_ID)
    expect((await inviteRow(inv.id)).status).toBe('pending')
  })

  it('moves the user with their role, invoices and receipts; keeps projects, progress, XP and streak', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    const inv = await invite(school.id, kid.email)
    const second = await invite((await makeOrg()).id, kid.email)

    // History that must come along or stay put.
    const paid = await makeInvoice(kid.id, 'paid')
    await db.insert(receipts).values({
      invoiceId: paid.id,
      userId: kid.id,
      orgId: DIRECT_ORG_ID,
      amountCents: 1000,
      description: 'Term fee',
      paidAt: '2026-09-01T00:00:00Z',
      receiptNumber: 'R-TEST-1',
    })
    const directClass = await makeClass()
    await addClassMember(directClass.id, kid.id, 'student')
    const project = await makeProject(kid.id)
    await setLessonProgress(project.id, [LESSONS[0].tasks[0].id], '2026-09-01T00:00:00Z')
    await db.insert(activityDays).values({ userId: kid.id, day: todayISO() })
    const before = await getPlayerStats(kid.id)
    expect(before.xp).toBeGreaterThan(0)
    expect(before.streak).toBe(1)

    signIn(kid)
    const res = await acceptIt(inv.id)
    expect(res.status).toBe(200)

    expect((await reload(kid.id)).orgId).toBe(school.id)
    expect(await grantsOf(kid.id)).toEqual([{ name: 'student', orgId: school.id }])
    expect((await db.select().from(invoices).where(eq(invoices.userId, kid.id)))[0].orgId).toBe(
      school.id
    )
    expect((await db.select().from(receipts).where(eq(receipts.userId, kid.id)))[0].orgId).toBe(
      school.id
    )
    expect(await db.select().from(classMembers).where(eq(classMembers.userId, kid.id))).toEqual([])

    expect(await db.select().from(projects).where(eq(projects.userId, kid.id))).toHaveLength(1)
    expect(
      (await db.select().from(lessonProgress).where(eq(lessonProgress.projectId, project.id)))[0]
        .completedTaskIds
    ).toEqual([LESSONS[0].tasks[0].id])
    expect(await getPlayerStats(kid.id)).toEqual(before)

    expect((await inviteRow(inv.id)).status).toBe('accepted')
    expect((await inviteRow(second.id)).status).toBe('declined')
  })

  it('leaves a Direct admin who accepts a student invite with no admin or teacher grant', async () => {
    const school = await makeOrg()
    const boss = await makeUser()
    await grantRole(boss.id, 'admin')
    await grantRole(boss.id, 'teacher')
    await grantRole(boss.id, 'platform_admin')
    const otherAdmin = await makeUser()
    await grantRole(otherAdmin.id, 'admin')
    const inv = await invite(school.id, boss.email)
    signIn(boss)

    expect((await acceptIt(inv.id)).status).toBe(200)
    expect(await grantsOf(boss.id)).toEqual([
      { name: 'platform_admin', orgId: null },
      { name: 'student', orgId: school.id },
    ])
  })

  it('grants a teacher invite in the new org', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    const inv = await invite(school.id, kid.email, 'teacher')
    signIn(kid)

    expect((await acceptIt(inv.id)).status).toBe(200)
    expect(await grantsOf(kid.id)).toEqual([
      { name: 'student', orgId: school.id },
      { name: 'teacher', orgId: school.id },
    ])
  })

  it('refuses while an unpaid Direct invoice exists, with a clear message', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    await makeInvoice(kid.id, 'unpaid')
    const inv = await invite(school.id, kid.email)
    signIn(kid)

    const res = await acceptIt(inv.id)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(UNPAID_MESSAGE)
    expect((await reload(kid.id)).orgId).toBe(DIRECT_ORG_ID)
    expect(await grantsOf(kid.id)).toEqual([{ name: 'student', orgId: DIRECT_ORG_ID }])
    expect((await inviteRow(inv.id)).status).toBe('pending')
  })

  it('lets a paid or void invoice through', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    await makeInvoice(kid.id, 'void')
    const inv = await invite(school.id, kid.email)
    signIn(kid)
    expect((await acceptIt(inv.id)).status).toBe(200)
  })

  it('never removes Direct’s last admin', async () => {
    const school = await makeOrg()
    const boss = await makeUser()
    await grantRole(boss.id, 'admin')
    const inv = await invite(school.id, boss.email)
    signIn(boss)

    const res = await acceptIt(inv.id)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(LAST_ADMIN_MESSAGE)
    expect((await reload(boss.id)).orgId).toBe(DIRECT_ORG_ID)
    expect(await grantsOf(boss.id)).toEqual([{ name: 'admin', orgId: DIRECT_ORG_ID }])
  })

  it('refuses a paused school, and a user already in a school', async () => {
    const paused = await makeOrg({ status: 'suspended' })
    const kid = await directStudent()
    const inv = await invite(paused.id, kid.email)
    signIn(kid)
    expect((await acceptIt(inv.id)).status).toBe(409)
    expect((await reload(kid.id)).orgId).toBe(DIRECT_ORG_ID)

    const schoolA = await makeOrg()
    const member = await makeUser({ orgId: schoolA.id })
    const inv2 = await invite((await makeOrg()).id, member.email)
    signIn(member)
    expect((await acceptIt(inv2.id)).status).toBe(409)
    expect((await reload(member.id)).orgId).toBe(schoolA.id)
  })

  it('answers 404 for an invite already answered', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    const inv = await invite(school.id, kid.email)
    await db.update(orgInvites).set({ status: 'revoked' }).where(eq(orgInvites.id, inv.id))
    signIn(kid)
    expect((await acceptIt(inv.id)).status).toBe(404)
  })
})

describe('POST /api/invites/[id]/decline', () => {
  it('declines the user’s own invite without moving them', async () => {
    const school = await makeOrg()
    const kid = await directStudent()
    const inv = await invite(school.id, kid.email)
    signIn(kid)

    expect((await declineIt(inv.id)).status).toBe(200)
    expect((await inviteRow(inv.id)).status).toBe('declined')
    expect((await reload(kid.id)).orgId).toBe(DIRECT_ORG_ID)
  })

  it('refuses someone else’s invite', async () => {
    const school = await makeOrg()
    const owner = await directStudent()
    const inv = await invite(school.id, owner.email)
    signIn(await directStudent())
    expect((await declineIt(inv.id)).status).toBe(404)
    expect((await inviteRow(inv.id)).status).toBe('pending')
  })
})
