import { betterAuth } from 'better-auth'
import { createPool } from 'mysql2/promise'
import { getDockerSecret } from '$lib/server/db'
import { env } from '$env/dynamic/private'

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_BASE_URL,
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
			clientId: env.GOOGLE_CLIENT_ID as string,
			clientSecret: env.GOOGLE_CLIENT_SECRET as string
		}
	}
})

//www.better-auth.com/docs/authentication/google

//auth-client.ts
// https: import { createAuthClient } from 'better-auth/client'
// const authClient = createAuthClient()

// const signIn = async () => {
// 	const data = await authClient.signIn.social({
// 		provider: 'google'
// 	})
// }

// http://localhost:3001/api/auth/callback/google

// http://pfbonnet.dev/api/auth/callback/google
