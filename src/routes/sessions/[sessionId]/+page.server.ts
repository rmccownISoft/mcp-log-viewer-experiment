import type { PageServerLoad } from './$types'
import type { ToolRun } from '$lib/server/types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { sessionId } = params

	try {
		// Call our API endpoint
		const response = await fetch(`/api/sessions/${sessionId}`)

		if (!response.ok) {
			throw new Error(`Failed to fetch session: ${response.statusText}`)
		}

		const data = await response.json()

		return {
			sessionId,
			toolRuns: data.toolRuns as ToolRun[],
			count: data.count
		}
	} catch (error) {
		console.error('Error loading session:', error)

		// Return empty data on error
		return {
			sessionId,
			toolRuns: [] as ToolRun[],
			count: 0,
			error: error instanceof Error ? error.message : 'Unknown error'
		}
	}
}
