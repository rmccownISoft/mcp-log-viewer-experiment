import { json } from '@sveltejs/kit'
import { pool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import type { LogRow, ToolRun } from '$lib/server/types'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url }) => {
	const { sessionId } = params

	// Get query parameters
	const toolOnly = url.searchParams.get('toolOnly') === 'true'

	try {
		// Query logs that mention this session ID
		// We use LIKE on message since meta is just TEXT
		const query = `
            SELECT 
                id, timestamp, hostname, company_code, app_name, 
                level, message, meta
            FROM errsole_logs_v3
            WHERE message LIKE ?
            ORDER BY timestamp ASC, id ASC
            LIMIT 1000
        `

		// The LIKE pattern searches for the session ID anywhere in the message
		const searchPattern = `%${sessionId}%`

		const [rows] = await pool.query<LogRow[]>(query, [searchPattern])

		// Parse all rows into ToolRuns (filter out nulls - non-tool events)
		let toolRuns = (rows as LogRow[])
			.map(parseToolRun)
			.filter((run): run is ToolRun => run !== null)

		// Filter to only events that actually have this session ID
		// (our LIKE search might catch false positives)
		toolRuns = toolRuns.filter((run) => run.sessionId === sessionId)

		return json({
			sessionId,
			toolRuns,
			count: toolRuns.length
		})
	} catch (error) {
		console.error('Error fetching session:', error)

		return json(
			{
				error: 'Failed to fetch session data',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}
