import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

// Serves the whole Better Auth surface: /api/auth/sign-in/social,
// /api/auth/callback/google, /api/auth/sign-out, /api/auth/get-session, …
// The Google OAuth client's authorized redirect URI must point at
// <BETTER_AUTH_URL>/api/auth/callback/google.
export const { GET, POST } = toNextJsHandler(auth)
