import { auth } from './auth'
import type { Handle } from '@sveltejs/kit'
import { redirect } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	})

	event.locals.user = session?.user ?? null
	event.locals.session = session?.session ?? null

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/api/auth', '/api/health']
	const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route))

	// Redirect to login if not authenticated and trying to access protected route
	if (!session && !isPublicRoute) {
		throw redirect(303, '/login')
	}

	return resolve(event)
}
