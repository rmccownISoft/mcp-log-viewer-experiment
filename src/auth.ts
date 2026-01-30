import { betterAuth } from 'better-auth'
import { createPool } from 'mysql2/promise'
import { getDockerSecret } from '$lib/server/db'
import { env } from '$env/dynamic/private'

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_BASE_URL,
	// Allow localhost for health checks and local testing
	trustedOrigins: ['http://localhost:3001', 'https://pfbonnet.dev'],
	database: createPool({
		connectionLimit: 10,
		database: env.AUTH_DB,
		host: env.AUTH_DB_HOST,
		user: env.AUTH_DB_USER,
		password: getDockerSecret(`AUTH_DB_PASSWORD`) || env.AUTH_DB_PASSWORD,
		queueLimit: 0,
		waitForConnections: true
	}),
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID || '',
			clientSecret: env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
		}
	}
})

//www.better-auth.com/docs/authentication/google
