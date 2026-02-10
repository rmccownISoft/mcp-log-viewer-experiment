import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { pool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import type { ToolRun } from '$lib/server/types'

export const GET: RequestHandler = async ({ url }) => {
	// Parse query parameters
	const hostname = url.searchParams.get('hostname') || ''
	const companyCode = url.searchParams.get('companyCode') || ''
	const appName = url.searchParams.get('appName') || ''
	const level = url.searchParams.get('level') || ''
	const q = url.searchParams.get('q') || '' // Text search
	const limit = parseInt(url.searchParams.get('limit') || '50')
	const offset = parseInt(url.searchParams.get('offset') || '0')
	const id = url.searchParams.get('id') || ''
	// Additional filters to apply after parsing
	const toolName = url.searchParams.get('toolName') || ''
	const status = url.searchParams.get('status') || ''
	const version = url.searchParams.get('version') || ''
	const userContextSearch = url.searchParams.get('userContextSearch') || ''
	console.log('id: ', id)
	try {
		// Build SQL query with basic filters
		let sql = 'SELECT * FROM errsole_logs_v3 WHERE 1=1'
		const params: any[] = []

		// Apply basic filters
		if (hostname) {
			sql += ' AND hostname = ?'
			params.push(hostname)
		}

		if (companyCode) {
			sql += ' AND company_code = ?'
			params.push(parseInt(companyCode))
		}

		if (appName) {
			sql += ' AND app_name = ?'
			params.push(appName)
		}

		if (level) {
			sql += ' AND level = ?'
			params.push(level)
		}

		// Text search on message using FULLTEXT and the much slower LIKE...probably cause problems
		if (q) {
			sql += ' AND (MATCH(message) AGAINST (? IN BOOLEAN MODE) OR meta LIKE ?)'
			params.push(q, `%${q}%`) // safer than LIKE '%" + q + "%' I guess?
		}

		if (id) {
			// Split comma-separated IDs and convert to numbers
			const ids = id
				.split(',')
				.map((i) => parseInt(i.trim()))
				.filter((i) => !isNaN(i))
			if (ids.length > 0) {
				sql += ' AND id IN (?)'
				params.push(ids)
			}
		}

		// Order by timestamp descending (most recent first)
		sql += ' ORDER BY timestamp DESC, id DESC'

		// Fetch more than needed since we'll filter for tool runs
		// Use a larger batch to ensure we get enough tool runs
		const fetchLimit = Math.min(limit * 10, 5000)
		sql += ' LIMIT ? OFFSET ?'
		params.push(fetchLimit, offset)
		console.log('sql: ', sql)
		// Execute query
		const [rows] = await pool.query(sql, params)

		// Parse rows and filter for tool runs
		let toolRuns: ToolRun[] = []
		for (const row of rows as any[]) {
			const toolRun = parseToolRun(row)
			if (toolRun) {
				toolRuns.push(toolRun)
			}
		}

		// Apply additional filters (post-parse)
		if (toolName) {
			toolRuns = toolRuns.filter((tr) => tr.toolName.toLowerCase().includes(toolName.toLowerCase()))
		}

		if (status) {
			toolRuns = toolRuns.filter((tr) => tr.status === status)
		}

		if (version) {
			toolRuns = toolRuns.filter((tr) => tr.mcpVersion?.includes(version))
		}

		if (userContextSearch) {
			toolRuns = toolRuns.filter((tr) =>
				tr.userContext?.toLowerCase().includes(userContextSearch.toLowerCase())
			)
		}

		// Apply final pagination
		const paginatedRuns = toolRuns.slice(0, limit)

		return json({
			toolRuns: paginatedRuns,
			hasMore: toolRuns.length > limit,
			total: paginatedRuns.length
		})
	} catch (error) {
		console.error('Error fetching tool runs:', error)
		return json({ error: 'Failed to fetch tool runs' }, { status: 500 })
	}
}
