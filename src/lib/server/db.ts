import mysql from 'mysql2/promise'
import type { Pool, PoolOptions } from 'mysql2/promise'
import fs from 'fs'
import { env } from '$env/dynamic/private'

export const getDockerSecret = (secretName: string) => {
	try {
		const secretFromFile = fs.readFileSync(`/run/secrets/${secretName}`, 'utf8').toString().trim()
		console.info(`${secretName} file successfully read`)
		return secretFromFile
	} catch (err) {
		console.error(`${secretName} file not present or not readable: ${err}`)
		return undefined
	}
}

export const createConnectionPool = (config: PoolOptions, name: string): Pool => {
	const pool = mysql.createPool(config)

	console.debug(`${name} connection pool created`)

	return pool
}

export const closeConnectionPool = async (pool: Pool, name: string): Promise<void> => {
	try {
		await pool.end()
		console.debug(`${name} connection pool closed`)
	} catch (err) {
		console.error(`Error closing ${name} pool:`, err)
		throw err
	}
}

const pool = mysql.createPool({
	connectionLimit: 10,
	database: env.ERRSOLE_DB_NAME,
	host: env.ERRSOLE_DB_HOST,
	user: env.ERRSOLE_DB_USER,
	password: getDockerSecret(`ERRSOLE_DB_PASSWORD`) || env.ERRSOLE_DB_PASSWORD,
	queueLimit: 0,
	waitForConnections: true
})

// Log connection info (without password) for debugging
console.debug('Database pool created with:', {
	host: env.ERRSOLE_DB_HOST,
	database: env.ERRSOLE_DB_NAME,
	user: env.ERRSOLE_DB_USER,
	hasPassword: !!env.ERRSOLE_DB_PASSWORD
})

// For complex ops?
export async function getConnection() {
	return await pool.getConnection()
}

export { pool }
