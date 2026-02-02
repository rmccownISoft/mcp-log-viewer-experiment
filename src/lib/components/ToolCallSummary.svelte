<script lang="ts">
	import type { ToolRun } from '$lib/server/types'
	import { goto } from '$app/navigation'

	let { data }: { data: ToolRun } = $props()

	let formattedResult = $derived(data ? formatResult(data.resultText) : null)
	let formattedQuery = $derived(data ? formatQuery(data.gqlQuery) : null)
	let copied = $state(false)
	let queryCopied = $state(false)

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text)
			copied = true
			setTimeout(() => {
				copied = false
			}, 2000)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}

	async function copyQueryToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text)
			queryCopied = true
			setTimeout(() => {
				queryCopied = false
			}, 2000)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}
	function formatQuery(queryText: string | null): string | null {
		if (!queryText) return null
		// GraphQL queries are already formatted text, just return as-is
		return queryText.trim()
	}

	function formatResult(resultText: Array<string> | null): { formatted: string; isJson: boolean } {
		if (!resultText || resultText.length === 0) {
			return { formatted: 'No result', isJson: false }
		}

		// Join all result strings
		const combinedText = resultText.join('\n\n')

		try {
			// Try to parse as JSON - if it's a single JSON string
			const parsed = JSON.parse(combinedText)
			return {
				formatted: JSON.stringify(parsed, null, 2),
				isJson: true
			}
		} catch {
			// Not JSON, or multiple items - try formatting each individually
			const formatted = resultText
				.map((text) => {
					try {
						const parsed = JSON.parse(text)
						return JSON.stringify(parsed, null, 2)
					} catch {
						return text
					}
				})
				.join('\n\n---\n\n')

			return {
				formatted,
				isJson: false
			}
		}
	}

	function formatDuration(ms: number | null): string {
		if (ms === null) return 'N/A'
		if (ms < 1000) return `${ms}ms`
		return `${(ms / 1000).toFixed(2)}s`
	}

	function formatTimestamp(date: Date | undefined): string {
		if (!date) return 'N/A'
		return new Date(date).toLocaleString()
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'success':
				return 'badge-success'
			case 'failure':
				return 'badge-failure'
			default:
				return 'badge-unknown'
		}
	}
</script>

<div class="body">
	<div class="detail-section">
		<h3>Basic Info</h3>
		<dl>
			<dt>Log Id:</dt>
			<dd>{data.id}</dd>
			<dt>Timestamp:</dt>
			<dd>{formatTimestamp(data.timestamp)}</dd>
			<dt>Company Code:</dt>
			<dd>{data.companyCode}</dd>
			<dt>App Name:</dt>
			<dd>{data.appName}</dd>
			<dt>Version:</dt>
			<dd>{data.mcpVersion || 'N/A'}</dd>
			<dt>Session ID:</dt>
			<dd class="monospace session-id-row">
				{data.sessionId}
				<a
					href="/sessions/{data.sessionId}"
					class="session-link"
					title="View session details"
					onclick={(e) => {
						e.stopPropagation()
						if (data) {
							goto(`/sessions/${data.sessionId}`)
						}
					}}
				>
					<i class="fa fa-external-link" aria-hidden="true"></i>
				</a>
			</dd>
		</dl>
	</div>
	<div class="detail-section">
		<h3>Tool Info</h3>
		<dl>
			<dt>Tool Name:</dt>
			<dd>{data.toolName}</dd>
			<dt>Status:</dt>
			<dd>
				<span class="badge {getStatusBadgeClass(data.status)}">
					{data.status}
				</span>
			</dd>
			<dt>Duration:</dt>
			<dd>{formatDuration(data.durationMs)}</dd>
		</dl>
	</div>
	<div class="detail-section">
		<h3>Prompt</h3>
		<pre class="code-block">{data.userContext}</pre>
	</div>
	<div class="detail-section">
		<div class="section-header">
			<h3>Result {formattedResult?.isJson ? '(JSON)' : ''}</h3>
			<button
				class="copy-btn"
				onclick={() => formattedResult && copyToClipboard(formattedResult.formatted)}
				title="Copy to clipboard"
			>
				{#if copied}
					✓ Copied!
				{:else}
					📋 Copy Result
				{/if}
			</button>
		</div>
		<pre class="code-block result-block">{formattedResult?.formatted}</pre>
	</div>
	<div class="detail-section">
		<div class="section-header">
			<h3>GraphQL Metadata</h3>
			{#if formattedQuery}
				<button
					class="copy-btn"
					onclick={() => formattedQuery && copyQueryToClipboard(formattedQuery)}
					title="Copy query to clipboard"
				>
					{#if queryCopied}
						✓ Copied!
					{:else}
						📋 Copy Query
					{/if}
				</button>
			{/if}
		</div>
		<dl>
			<dt>GQL Calls:</dt>
			<dd>{data.gqlCount}</dd>
			<dt>Max GQL Time:</dt>
			<dd>
				{data.gqlMaxTimeMs ? `${data.gqlMaxTimeMs}ms` : 'N/A'}
			</dd>
		</dl>
		{#if formattedQuery}
			<h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: #333;">GraphQL Query</h4>
			<pre class="code-block query-block">{formattedQuery}</pre>
		{/if}
	</div>
</div>

<style>
	.body {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-section {
		margin-bottom: 0;
	}

	.detail-section h3 {
		margin-top: 0;
		margin-bottom: 0.75rem;
		color: #333;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.detail-section h4 {
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: #333;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.detail-section dl {
		display: grid;
		grid-template-columns: 150px 1fr;
		gap: 0.5rem;
		margin: 0;
	}

	.detail-section dt {
		font-weight: 600;
		color: #666;
	}

	.detail-section dd {
		margin: 0;
		color: #333;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.section-header h3 {
		margin: 0;
		color: #333;
	}

	.copy-btn {
		padding: 0.375rem 0.75rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
		white-space: nowrap;
	}

	.copy-btn:hover {
		background: #0056b3;
	}

	.code-block {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.result-block {
		max-height: 400px;
		overflow-y: auto;
		overflow-x: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.query-block {
		max-height: 300px;
		overflow-y: auto;
		overflow-x: auto;
		border: 1px solid #ddd;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.json-result {
		background: #1e1e1e;
		color: #d4d4d4;
		padding: 1rem;
		line-height: 1.5;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge-success {
		background: #d4edda;
		color: #155724;
	}

	.badge-failure {
		background: #f8d7da;
		color: #721c24;
	}

	.badge-unknown {
		background: #fff3cd;
		color: #856404;
	}

	.error-section {
		background: #fff5f5;
		padding: 1rem;
		border-left: 4px solid #c00;
		border-radius: 4px;
	}

	.version-badge {
		background: #007bff;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: monospace;
	}
</style>
