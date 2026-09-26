import { and, asc, count, eq, isNull, or } from 'drizzle-orm'
import { aiRequestsByUser } from '@/lib/ai-usage'
import { db } from '@/lib/db/client'
import {
  classMembers,
  classes,
  organizations,
  roles,
  studentProfiles,
  userRoles,
  users,
} from '@/lib/db/schema'

// Read-only lists across every org for the platform owner's console
// (/console/classes, /console/students, /console/users). Cross-org on
// purpose: only app/console/layout.tsx (isPlatformAdmin) reaches these. The
// org-scoped /staff pages keep their own loaders; nothing here writes.

export type OrgOption = { id: string; name: string }

export function loadOrgOptions(): Promise<OrgOption[]> {
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .orderBy(asc(organizations.name))
}

// Members counted only when the member's org is the class's org:
// class_members has no FK tying the two together.
async function memberCounts() {
  const rows = await db
    .select({ classId: classMembers.classId, role: classMembers.role, n: count() })
    .from(classMembers)
    .innerJoin(classes, eq(classes.id, classMembers.classId))
    .innerJoin(users, eq(users.id, classMembers.userId))
    .where(eq(users.orgId, classes.orgId))
    .groupBy(classMembers.classId, classMembers.role)
  return rows
}

export interface PlatformClass {
  id: string
  name: string
  description: string | null
  orgId: string
  orgName: string
  students: number
  teachers: number
  createdAt: string
}

export async function loadAllClasses(): Promise<PlatformClass[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: classes.id,
        name: classes.name,
        description: classes.description,
        orgId: classes.orgId,
        orgName: organizations.name,
        createdAt: classes.createdAt,
      })
      .from(classes)
      .innerJoin(organizations, eq(organizations.id, classes.orgId))
      .orderBy(asc(organizations.name), asc(classes.name)),
    memberCounts(),
  ])
  const n = (classId: string, role: string) =>
    Number(counts.find((c) => c.classId === classId && c.role === role)?.n ?? 0)
  return rows.map((r) => ({ ...r, students: n(r.id, 'student'), teachers: n(r.id, 'teacher') }))
}

export interface PlatformStudent {
  id: string
  name: string
  email: string
  orgId: string
  orgName: string
  isActive: boolean
  classes: number
  aiRequests: number
  createdAt: string
}

// A student is a user with a student profile.
export async function loadAllStudents(): Promise<PlatformStudent[]> {
  const [rows, enrolled, aiRequests] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        userName: users.name,
        fullName: studentProfiles.fullName,
        orgId: users.orgId,
        orgName: organizations.name,
        isActive: studentProfiles.isActive,
        createdAt: studentProfiles.createdAt,
      })
      .from(studentProfiles)
      .innerJoin(users, eq(users.id, studentProfiles.userId))
      .innerJoin(organizations, eq(organizations.id, users.orgId)),
    db
      .select({ userId: classMembers.userId, n: count() })
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .innerJoin(users, eq(users.id, classMembers.userId))
      .where(and(eq(classMembers.role, 'student'), eq(users.orgId, classes.orgId)))
      .groupBy(classMembers.userId),
    aiRequestsByUser(),
  ])
  const classCount = new Map(enrolled.map((e) => [e.userId, Number(e.n)]))
  return rows
    .map(({ userName, fullName, ...r }) => ({
      ...r,
      name: fullName || userName || '',
      classes: classCount.get(r.id) ?? 0,
      aiRequests: aiRequests.get(r.id) ?? 0,
    }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
}

export interface PlatformUser {
  id: string
  name: string
  email: string
  orgId: string
  orgName: string
  roles: string[]
  createdAt: string
}

export async function loadAllUsers(): Promise<PlatformUser[]> {
  const [rows, roleRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        orgId: users.orgId,
        orgName: organizations.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId)),
    // A role counts in the user's own org, plus the org-less platform_admin.
    db
      .select({ userId: userRoles.userId, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(or(eq(userRoles.orgId, users.orgId), isNull(userRoles.orgId))),
  ])
  const rolesById = new Map<string, string[]>()
  for (const r of roleRows) rolesById.set(r.userId, [...(rolesById.get(r.userId) ?? []), r.name])
  return rows
    .map((u) => ({
      ...u,
      createdAt: new Date(u.createdAt).toISOString(),
      roles: rolesById.get(u.id) ?? [],
    }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
}
