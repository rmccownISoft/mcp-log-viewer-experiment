import { json } from '@sveltejs/kit'
import { pool } from '$lib/server/db'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
    try {
        await pool.query('SELECT 1 as test')
        // Sveltekit json helper
        return json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Health check failed:', error)
        
        return json({
          status: 'error',
          database: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}