<script lang="ts">
	import { onMount } from 'svelte'
	import { authClient } from '$lib/auth-client'
	import { signIn } from '$lib/auth-client'

	let healthStatus = $state({ status: 'checking', database: 'unknown' })
	let { data } = $props()
	//$inspect(data)
	onMount(async () => {
		try {
			const response = await fetch('api/health')
			healthStatus = await response.json()
		} catch (error) {
			healthStatus = { status: 'error', database: 'disconnected' }
		}
	})
</script>

{#if data.session?.id}
	<main>
		<h1>MCP Log Explorer</h1>

		<section class="health-check">
			<h2>System Status</h2>
			<p>
				Database: <strong class:ok={healthStatus.database === 'connected'}>
					{healthStatus.database}
				</strong>
			</p>
		</section>

		<section class="navigation">
			<h2>Available Tools</h2>
			<ul>
				<li>
					<a href="/sessions">Session Explorer</a>
				</li>
				<li>
					<a href="/tool-runs">Tool Runs Browser</a>
				</li>
				<li>
					<a href="/prompts">Prompt Summary</a>
				</li>
			</ul>
		</section>
	</main>
{/if}

<style>
	main {
		max-width: 800px;
		margin: 2rem auto;
		padding: 0 1rem;
	}

	h1 {
		color: #333;
		border-bottom: 3px solid #4caf50;
		padding-bottom: 0.5rem;
	}

	.health-check {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 8px;
		margin: 1rem 0;
	}

	.health-check strong {
		color: #f44336;
	}

	.health-check strong.ok {
		color: #4caf50;
	}

	.navigation ul {
		list-style: none;
		padding: 0;
	}

	.navigation li {
		margin: 1rem 0;
		padding: 1rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.navigation a {
		color: #2196f3;
		text-decoration: none;
		font-weight: 500;
		font-size: 1.1rem;
	}
</style>
