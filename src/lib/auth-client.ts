import { createAuthClient } from 'better-auth/svelte'

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_BASE_URL || 'http://localhost:3001'
})

export const { signIn, signUp, signOut, useSession } = authClient
