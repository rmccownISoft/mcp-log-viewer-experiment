import { json } from '@sveltejs/kit'
import { pool } from '$lib/server/db'
import { rowToEvent } from '$lib/server/parsers'
import type { LogRow } from '$lib/server/types'
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
      
        // Parse all rows into Events
        let events = (rows as LogRow[]).map(rowToEvent)
      
        // Filter to only events that actually have this session ID
        // (our LIKE search might catch false positives)
        events = events.filter(event => event.sessionId === sessionId)
      
        // If toolOnly filter is on, keep only tool-related events
        if (toolOnly) {
            events = events.filter(event => event.toolName !== null)
        }
      
        return json({
            sessionId,
            events,
            count: events.length,
            toolOnly
        })
      
    } catch (error) {
        console.error('Error fetching session:', error)
      
        return json({
            error: 'Failed to fetch session data',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}