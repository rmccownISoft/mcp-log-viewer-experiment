import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { pool } from '$lib/server/db'

export const GET: RequestHandler = async () => {
	try {
		// Query to get distinct app names from the database
		const sql = `SELECT DISTINCT app_name FROM errsole_logs_v3 WHERE app_name LIKE '&mcp&' ORDER BY app_name`

		const [rows] = await pool.execute(sql)

		// Extract app names from rows
		const appNames = (rows as any[]).map((row) => row.app_name)

		return json({
			appNames
		})
	} catch (error) {
		console.error('Error fetching app names:', error)
		return json({ error: 'Failed to fetch app names' }, { status: 500 })
	}
}
