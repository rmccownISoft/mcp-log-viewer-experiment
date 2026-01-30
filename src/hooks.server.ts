import { auth } from './auth' // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'
import { redirect } from '@sveltejs/kit'

export async function handle({ event, resolve }) {
	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers
	})
	// Make session and user available on server
	if (session) {
		event.locals.session = session.session
		event.locals.user = session.user
	}

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/api/auth', '/api/health']
	const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route))

	// Redirect to login if not authenticated and trying to access protected route
	if (!session && !isPublicRoute && !building) {
		throw redirect(303, '/login')
	}
	return svelteKitHandler({ event, resolve, auth, building })
}
//https://khromov.se/the-comprehensive-guide-to-locals-in-sveltekit/
