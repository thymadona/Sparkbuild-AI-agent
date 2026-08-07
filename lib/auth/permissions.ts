import { supabaseAdmin } from '@/lib/supabase-server'
import { cached } from '@/lib/cache'

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  if (error) {
    console.error('getUserRoles failed:', error)
    throw error
  }

  return (data ?? []).map((row) => (row as unknown as { roles: { name: string } }).roles.name)
}

// Fail closed, unlike lib/ratelimit.ts's checkRateLimit (which fails open —
// worst case there is a missed rate limit). A failure here must deny
// access: this guards admin/PII surfaces, where the safe default is "no
// access", not "any access".
export async function hasPermission(userId: string, key: string): Promise<boolean> {
  return cached(`perm:${userId}:${key}`, 30, async () => {
    const { data, error } = await supabaseAdmin.rpc('has_permission', { p_user_id: userId, p_key: key })
    if (error) {
      console.error(`hasPermission(${key}) failed:`, error)
      return false
    }
    return data === true
  })
}

export async function isAdmin(userId: string): Promise<boolean> {
  return cached(`role:admin:${userId}`, 30, async () => {
    const { data, error } = await supabaseAdmin.rpc('is_admin', { p_user_id: userId })
    if (error) {
      console.error('isAdmin failed:', error)
      return false
    }
    return data === true
  })
}

// True if userId holds the teacher role, regardless of class assignment —
// used to exempt teachers from the per-class lesson-enabled toggle, which is
// meant to gate students, not the teachers who set it. Fails closed like
// isAdmin, rather than throwing like getUserRoles, so a lookup failure here
// denies the bypass instead of crashing the page/route calling it.
export async function isTeacher(userId: string): Promise<boolean> {
  return cached(`role:teacher:${userId}`, 30, async () => {
    try {
      const roles = await getUserRoles(userId)
      return roles.includes('teacher')
    } catch {
      return false
    }
  })
}

export async function requirePermission(userId: string, key: string): Promise<void> {
  if (!(await hasPermission(userId, key))) {
    throw new ForbiddenError(`Missing permission: ${key}`)
  }
}

// True if userId teaches this specific class, or is an admin.
export async function isTeacherOfClass(userId: string, classId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('is_teacher_of_class', {
    p_user_id: userId,
    p_class_id: classId,
  })
  if (error) {
    console.error('isTeacherOfClass failed:', error)
    return false
  }
  return data === true
}

// Class ids this user teaches. Does NOT include "all classes" for admins —
// callers needing admin-sees-everything should check isAdmin() separately.
export async function getTeacherClassIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('class_members')
    .select('class_id')
    .eq('user_id', userId)
    .eq('role', 'teacher')

  if (error) {
    console.error('getTeacherClassIds failed:', error)
    throw error
  }

  return (data ?? []).map((row) => row.class_id)
}
