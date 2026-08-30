'use client'

import { createAuthClient } from 'better-auth/react'

// Browser-side auth. Same origin as the app, so no baseURL is needed.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
