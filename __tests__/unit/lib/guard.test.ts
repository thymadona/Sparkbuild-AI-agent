import { decideGuard, type GuardInput } from '@/lib/auth/guard'

const BASE: GuardInput = {
  pathname: '/dashboard',
  user: { id: 'user-1', email: 'student@example.com' },
  isDeactivated: false,
  isAdmin: false,
  hasTeacherAccess: false,
  needsClassAssignment: false,
}

describe('decideGuard — unauthenticated', () => {
  it.each(['/dashboard', '/editor/1', '/profile', '/admin', '/teacher'])(
    'redirects to /login for %s',
    (pathname) => {
      expect(decideGuard({ ...BASE, pathname, user: null })).toEqual({ redirect: '/login' })
    }
  )

  it('allows an unguarded path through', () => {
    expect(decideGuard({ ...BASE, pathname: '/explore', user: null })).toBeNull()
  })
})

describe('decideGuard — deactivated student', () => {
  it('redirects to /login?reason=deactivated on a protected path', () => {
    expect(decideGuard({ ...BASE, pathname: '/dashboard', isDeactivated: true })).toEqual({
      redirect: '/login',
      params: { reason: 'deactivated' },
    })
  })

  it('does not gate /admin on deactivation when the user is admin', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isDeactivated: true, isAdmin: true })).toBeNull()
  })
})

describe('decideGuard — needs class assignment', () => {
  it('redirects to /no-class on a protected path', () => {
    expect(decideGuard({ ...BASE, pathname: '/dashboard', needsClassAssignment: true })).toEqual({
      redirect: '/no-class',
    })
  })

  it('redirects on /editor too', () => {
    expect(decideGuard({ ...BASE, pathname: '/editor/1', needsClassAssignment: true })).toEqual({
      redirect: '/no-class',
    })
  })

  it('allows through when already assigned to a class', () => {
    expect(decideGuard({ ...BASE, pathname: '/dashboard', needsClassAssignment: false })).toBeNull()
  })

  it('does not gate /admin or /teacher — those paths are never isProtected', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isAdmin: true, needsClassAssignment: true })).toBeNull()
  })

  it('deactivation takes priority over needing a class when both are true', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/dashboard', isDeactivated: true, needsClassAssignment: true })
    ).toEqual({ redirect: '/login', params: { reason: 'deactivated' } })
  })
})

describe('decideGuard — /admin', () => {
  it('redirects to /dashboard when not admin', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isAdmin: false })).toEqual({ redirect: '/dashboard' })
  })

  it('allows through when admin', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isAdmin: true })).toBeNull()
  })
})

describe('decideGuard — /teacher', () => {
  it('redirects to /dashboard when hasTeacherAccess is false', () => {
    expect(decideGuard({ ...BASE, pathname: '/teacher', hasTeacherAccess: false })).toEqual({
      redirect: '/dashboard',
    })
  })

  it('allows through when hasTeacherAccess is true', () => {
    expect(decideGuard({ ...BASE, pathname: '/teacher', hasTeacherAccess: true })).toBeNull()
  })

  it('does not auto-grant teacher access to admins — hasTeacherAccess must be computed by the caller', () => {
    expect(decideGuard({ ...BASE, pathname: '/teacher', isAdmin: true, hasTeacherAccess: false })).toEqual({
      redirect: '/dashboard',
    })
  })
})
