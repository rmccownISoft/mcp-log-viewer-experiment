import { auth } from './auth' // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'

export async function handle({ event, resolve }) {
	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers
	})
	console.log('session?: ', session)
	// Make session and user available on server
	if (session) {
		event.locals.session = session.session
		event.locals.user = session.user
	}

	return svelteKitHandler({ event, resolve, auth, building })
}
//https://khromov.se/the-comprehensive-guide-to-locals-in-sveltekit/
