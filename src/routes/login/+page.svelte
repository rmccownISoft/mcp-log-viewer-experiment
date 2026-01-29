<script lang="ts">
	import { authClient } from '$lib/auth-client'

	async function loginWithGoogle() {
		await authClient.signIn.social({
			provider: 'google',
			callbackURL: '/',
			errorCallbackURL: '/',
			newUserCallbackURL: '/'
		})
	}
</script>

<div class="login-container">
	<div class="login-card">
		<h1>MCP Log Explorer</h1>
		<p>Sign in to explore your MCP logs and sessions</p>
		<button class="login-button" onclick={loginWithGoogle}> Login with Google </button>
	</div>
</div>

<style>
	.login-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		background: white;
	}
	.login-card {
		background: white;
		padding: 3rem;
		border-radius: 12px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
		text-align: center;
		max-width: 400px;
	}
	.login-card h1 {
		color: #333;
		margin-bottom: 1rem;
		border: none;
	}
	.login-card p {
		color: #666;
		margin-bottom: 2rem;
	}
	.login-button {
		padding: 0.75rem 1.5rem;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}
	.login-button:hover {
		background: #357ae8;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
	}
</style>
