import { createAuthClient } from 'better-auth/svelte'
export const authClient = createAuthClient({})

export const { signIn, signUp, signOut, useSession } = authClient

// import { createAuthClient } from "better-auth/client";
// const authClient = createAuthClient();
// const signIn = async () => {
//   const data = await authClient.signIn.social({
//     provider: "google",
//   });
// };
