import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { pool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import { compareByVersion } from '$lib/server/aggregators'

export const GET: RequestHandler = async ({ url }) => {
	// Required parameters
	const userContext = url.searchParams.get('userContext')
	const toolName = url.searchParams.get('toolName')

	if (!userContext || !toolName) {
		return json({ error: 'userContext and toolName are required' }, { status: 400 })
	}

	const hostname = url.searchParams.get('hostname') || ''

	try {
		// Query for this specific userContext
		// We search in message since userContext is in meta
		let sql = `
      SELECT * FROM errsole_logs_v3 
      WHERE message LIKE CONCAT('%', ?, '%')
    `
		const params: any[] = [userContext.slice(0, 50)] // Use first 50 chars for search

		if (hostname) {
			sql += ' AND hostname = ?'
			params.push(hostname)
		}

		sql += ' ORDER BY timestamp DESC LIMIT 500'

		const [rows] = await pool.execute(sql, params)

		// Parse into tool runs
		const toolRuns = (rows as any[])
			.map(parseToolRun)
			.filter((run): run is NonNullable<typeof run> => run !== null)

		// Compare by version
		const comparison = compareByVersion(toolRuns, userContext, toolName)

		if (!comparison) {
			return json({ error: 'No runs found for this prompt' }, { status: 404 })
		}

		return json(comparison)
	} catch (error) {
		console.error('Error comparing versions:', error)
		return json({ error: 'Failed to compare versions' }, { status: 500 })
	}
}
