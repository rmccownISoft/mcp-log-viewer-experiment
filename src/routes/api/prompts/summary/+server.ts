import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { pool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import { aggregateByPrompt } from '$lib/server/aggregatorHelpers'

export const GET: RequestHandler = async ({ url }) => {
	// Parse query parameters
	const companyCode = url.searchParams.get('companyCode') || ''
	const toolName = url.searchParams.get('toolName') || ''
	const minOccurrences = parseInt(url.searchParams.get('minOccurrences') || '1')
	const limit = parseInt(url.searchParams.get('limit') || '1000') // Fetch more for aggregation

	try {
		// Build SQL query - similar to tool-runs but we need more data
		let sql = 'SELECT * FROM errsole_logs_v3 WHERE 1=1'
		const params: any[] = []

		// Basic filters
		if (companyCode) {
			sql += ' AND company_code = ?'
			params.push(companyCode)
		}

		// Add date range filter if provided
		const startDate = url.searchParams.get('startDate')
		const endDate = url.searchParams.get('endDate')

		if (startDate) {
			sql += ' AND timestamp >= ?'
			params.push(startDate)
		}

		if (endDate) {
			sql += ' AND timestamp <= ?'
			params.push(endDate)
		}

		// Order and limit
		sql += ' ORDER BY timestamp DESC LIMIT ?'
		params.push(limit)

		// Execute query
		const [rows] = await pool.execute(sql, params)

		// Parse all rows into ToolRuns
		const toolRuns = (rows as any[])
			.map(parseToolRun)
			.filter((run): run is NonNullable<typeof run> => run !== null)

		// Apply post-query filters
		let filtered = toolRuns

		if (toolName) {
			filtered = filtered.filter((r) => r.toolName.toLowerCase().includes(toolName.toLowerCase()))
		}

		// Aggregate by prompt
		const summaries = aggregateByPrompt(filtered)

		// Filter by minimum occurrences
		const finalSummaries = summaries.filter((s) => s.totalRuns >= minOccurrences)

		return json({
			summaries: finalSummaries,
			total: finalSummaries.length
		})
	} catch (error) {
		console.error('Error fetching prompt summaries:', error)
		return json({ error: 'Failed to fetch prompt summaries' }, { status: 500 })
	}
}
