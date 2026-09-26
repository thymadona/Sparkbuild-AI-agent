import { decideGuard, type GuardInput } from '@/lib/auth/guard'

const BASE: GuardInput = {
  pathname: '/lessons',
  user: { id: 'user-1', email: 'student@example.com' },
  isDeactivated: false,
  isAdmin: false,
  hasTeacherAccess: false,
  isPlatformAdmin: false,
  isSuspended: false,
}

describe('decideGuard — unauthenticated', () => {
  it.each(['/lessons', '/board/1', '/profile', '/admin', '/teacher', '/staff', '/console'])(
    'redirects to /login for %s',
    (pathname) => {
      expect(decideGuard({ ...BASE, pathname, user: null })).toEqual({ redirect: '/login' })
    }
  )

  it('allows an unguarded path through', () => {
    expect(decideGuard({ ...BASE, pathname: '/about', user: null })).toBeNull()
  })
})

describe('decideGuard — deactivated student', () => {
  it('redirects to /login?reason=deactivated on a protected path', () => {
    expect(decideGuard({ ...BASE, pathname: '/lessons', isDeactivated: true })).toEqual({
      redirect: '/login',
      params: { reason: 'deactivated' },
    })
  })

  it('does not gate /admin on deactivation when the user is admin', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/admin', isDeactivated: true, isAdmin: true })
    ).toBeNull()
  })
})

describe('decideGuard — /admin', () => {
  it('redirects to /dashboard when not admin', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isAdmin: false })).toEqual({
      redirect: '/lessons',
    })
  })

  it('allows through when admin', () => {
    expect(decideGuard({ ...BASE, pathname: '/admin', isAdmin: true })).toBeNull()
  })
})

describe('decideGuard — /teacher', () => {
  it('redirects to /dashboard when hasTeacherAccess is false', () => {
    expect(decideGuard({ ...BASE, pathname: '/teacher', hasTeacherAccess: false })).toEqual({
      redirect: '/lessons',
    })
  })

  it('allows through when hasTeacherAccess is true', () => {
    expect(decideGuard({ ...BASE, pathname: '/teacher', hasTeacherAccess: true })).toBeNull()
  })

  it('does not auto-grant teacher access to admins — hasTeacherAccess must be computed by the caller', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/teacher', isAdmin: true, hasTeacherAccess: false })
    ).toEqual({
      redirect: '/lessons',
    })
  })
})

describe('decideGuard — /staff (unified admin+teacher dashboard)', () => {
  it('redirects to /dashboard when hasTeacherAccess is false', () => {
    expect(decideGuard({ ...BASE, pathname: '/staff', hasTeacherAccess: false })).toEqual({
      redirect: '/lessons',
    })
  })

  it('allows through when hasTeacherAccess is true (admin-inclusive by contract)', () => {
    expect(decideGuard({ ...BASE, pathname: '/staff', hasTeacherAccess: true })).toBeNull()
  })

  it('allows through nested /staff routes, e.g. /staff/classes/123', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/staff/classes/123', hasTeacherAccess: true })
    ).toBeNull()
  })

  it('does not auto-grant staff access to admins — hasTeacherAccess must be computed by the caller', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/staff', isAdmin: true, hasTeacherAccess: false })
    ).toEqual({
      redirect: '/lessons',
    })
  })
})

describe('decideGuard — /console', () => {
  it('sends a non-platform user, even an org admin, to /lessons', () => {
    expect(
      decideGuard({ ...BASE, pathname: '/console', isAdmin: true, hasTeacherAccess: true })
    ).toEqual({ redirect: '/lessons' })
  })

  it('lets the platform owner through', () => {
    expect(decideGuard({ ...BASE, pathname: '/console', isPlatformAdmin: true })).toBeNull()
  })
})

describe('decideGuard — suspended org', () => {
  it.each(['/lessons', '/board/1', '/staff', '/console', '/'])(
    'sends a paused member to /paused from %s',
    (pathname) => {
      expect(
        decideGuard({ ...BASE, pathname, isSuspended: true, isAdmin: true, hasTeacherAccess: true })
      ).toEqual({ redirect: '/paused' })
    }
  )

  it.each(['/paused', '/login'])('does not redirect %s, so there is no loop', (pathname) => {
    expect(decideGuard({ ...BASE, pathname, isSuspended: true })).toBeNull()
  })

  it('leaves /paused alone for everyone else', () => {
    expect(decideGuard({ ...BASE, pathname: '/paused' })).toBeNull()
  })
})
