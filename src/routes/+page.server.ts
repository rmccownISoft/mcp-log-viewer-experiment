import { auth } from '../auth'
import type { PageServerLoad } from './$types.js'

export const load: PageServerLoad = async (event) => {
	console.log('Server load running...')
	return {
		session: event.locals.session || event.locals.user || null
	}
}
