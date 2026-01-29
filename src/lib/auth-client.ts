import { createAuthClient } from 'better-auth/svelte'
export const authClient = createAuthClient({
	/** The base URL of the server (optional if you're using the same domain) */
	baseURL: 'http://localhost:3001'
})

export const { signIn, signUp, signOut, useSession } = createAuthClient()

// import { createAuthClient } from "better-auth/client";
// const authClient = createAuthClient();
// const signIn = async () => {
//   const data = await authClient.signIn.social({
//     provider: "google",
//   });
// };
