<script lang="ts">
	import type { PageData } from './$types'
	import ToolCallSummary from '$lib/components/ToolCallSummary.svelte'

	let { data }: { data: PageData } = $props()

	// State for detail drawer
	let selectedToolRun: (typeof data.toolRuns)[0] | null = $state(null)

	// All tool runs (no filtering needed - API already returns only tool runs)
	let toolRuns = $derived(data.toolRuns)

	function formatTime(timestamp: Date | string): string {
		const date = new Date(timestamp)
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		})
	}

	function formatDate(timestamp: Date | string): string {
		const date = new Date(timestamp)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'success':
				return '✓'
			case 'failure':
				return '✗'
			case 'unknown':
				return '?'
			default:
				return '○'
		}
	}

	function closeDrawer() {
		selectedToolRun = null
	}
</script>

<svelte:head>
	<title>Session {data.sessionId} | MCP Log Explorer</title>
</svelte:head>

<main>
	<header>
		<div class="breadcrumb">
			<a href="/sessions">← Sessions</a>
			<span>/</span>
			<span class="current">{data.sessionId}</span>
		</div>

		<h1>Session Timeline</h1>

		<div class="info-bar">
			<div class="info-item">
				<span class="label">Tool Runs:</span>
				<span class="value">{toolRuns.length}</span>
			</div>

			{#if data.toolRuns.length > 0 && data.toolRuns[0].timestamp}
				<div class="info-item">
					<span class="label">Date:</span>
					<span class="value">{formatDate(data.toolRuns[0].timestamp)}</span>
				</div>
			{/if}
		</div>
	</header>

	{#if data.toolRuns.length === 0}
		<div class="empty-state">
			<p>No tool runs found for this session.</p>
			<p class="hint">Make sure the session ID is correct, or try a different session.</p>
		</div>
	{:else}
		<div class="timeline">
			{#each toolRuns as toolRun (toolRun.id)}
				<button
					class="event-card"
					class:success={toolRun.status === 'success'}
					class:failure={toolRun.status === 'failure'}
					onclick={() => (selectedToolRun = toolRun)}
				>
					<div class="event-header">
						<span class="timestamp"
							>{toolRun.timestamp ? formatTime(toolRun.timestamp) : 'N/A'}</span
						>
						<span
							class="status-badge"
							class:success={toolRun.status === 'success'}
							class:failure={toolRun.status === 'failure'}
						>
							{getStatusIcon(toolRun.status)}
							{toolRun.status}
						</span>
					</div>

					<div class="event-body">
						<div class="tool-name">
							🔧 {toolRun.toolName}
						</div>

						{#if toolRun.userContext}
							<div class="user-context-preview">
								{toolRun.userContext.substring(0, 100)}{toolRun.userContext.length > 100
									? '...'
									: ''}
							</div>
						{/if}

						{#if toolRun.durationMs !== null}
							<div class="metadata">
								Duration: <span class="duration"
									>{toolRun.durationMs < 1000
										? `${toolRun.durationMs}ms`
										: `${(toolRun.durationMs / 1000).toFixed(2)}s`}</span
								>
							</div>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</main>

<!-- Detail Modal -->
{#if selectedToolRun}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeDrawer}
		onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h2>Tool Run Details</h2>
				<button class="close-btn" onclick={closeDrawer}>×</button>
			</div>

			<div class="modal-body">
				<ToolCallSummary data={selectedToolRun} />
			</div>
		</div>
	</div>
{/if}

<style>
	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		margin-bottom: 2rem;
	}

	.breadcrumb {
		color: #666;
		margin-bottom: 1rem;
	}

	.breadcrumb a {
		color: #2196f3;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.breadcrumb span.current {
		font-family: 'Courier New', monospace;
		color: #333;
	}

	h1 {
		margin: 0 0 1rem 0;
	}

	.info-bar {
		display: flex;
		gap: 2rem;
		align-items: center;
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 4px;
	}

	.info-item {
		display: flex;
		gap: 0.5rem;
	}

	.info-item .label {
		font-weight: 600;
		color: #666;
	}

	.info-item .value {
		color: #333;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #666;
	}

	.empty-state .hint {
		color: #999;
		font-size: 0.9rem;
	}

	/* Timeline */
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.event-card {
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		padding: 1rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s;
	}

	.event-card:hover {
		border-color: #2196f3;
		box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
	}

	.event-card.success {
		border-left-color: #4caf50;
	}

	.event-card.failure {
		border-left-color: #f44336;
	}

	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.timestamp {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: #666;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.status-badge.success {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.status-badge.failure {
		background: #ffebee;
		color: #c62828;
	}

	.event-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tool-name {
		font-weight: 600;
		color: #2196f3;
	}

	.metadata {
		font-size: 0.9rem;
		color: #666;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		max-width: 800px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #eee;
		position: sticky;
		top: 0;
		background: white;
		z-index: 1;
	}

	.modal-header h2 {
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: #999;
		line-height: 1;
	}

	.close-btn:hover {
		color: #333;
	}

	.modal-body {
		padding: 1.5rem;
	}
</style>
