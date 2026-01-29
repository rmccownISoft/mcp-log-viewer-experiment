<script lang="ts">
	import type { ToolRun } from '$lib/server/types'
	import { goto } from '$app/navigation'

	let { data } = $props()

	let appNameItems = $derived(data.appNames || [])
	// Initialize filters as mutable state (for two-way binding with inputs)
	let hostname = $state('')
	let companyCode = $state('')
	let appName = $state('')
	let level = $state('')
	let textSearch = $state('')
	let toolNameFilter = $state('')
	let statusFilter = $state('')
	let versionFilter = $state('')
	let showFailuresOnly = $state(false)

	// Results - derived from data prop
	let toolRuns = $derived(data.toolRuns)
	let loading = $state(false)
	let hasMore = $derived(data.hasMore)
	let error = $derived(data.error || '')
	let selectedRun = $state<ToolRun | null>(null)

	let offset = $state(0)
	let limit = $state(50)

	// Sync state with URL/data whenever navigation occurs
	$effect(() => {
		hostname = data.initialFilters?.hostname || ''
		companyCode = data.initialFilters?.companyCode || ''
		appName = data.initialFilters?.appName || ''
		level = data.initialFilters?.level || ''
		textSearch = data.initialFilters?.textSearch || ''
		toolNameFilter = data.initialFilters?.toolName || ''
		statusFilter = data.initialFilters?.status || ''
		versionFilter = data.initialFilters?.version || ''
		offset = data.initialFilters?.offset || 0
		limit = data.initialFilters?.limit || 100
	})

	function handleSearch() {
		offset = 0 // Reset to first page
		navigateWithFilters()
	}

	function nextPage() {
		offset += limit
		navigateWithFilters()
	}

	function prevPage() {
		offset = Math.max(0, offset - limit)
		navigateWithFilters()
	}

	function navigateWithFilters() {
		const params = new URLSearchParams()
		if (hostname) params.set('hostname', hostname)
		if (companyCode) params.set('companyCode', companyCode)
		if (appName) params.set('appName', appName)
		if (level) params.set('level', level)
		if (textSearch) params.set('q', textSearch)
		if (toolNameFilter) params.set('toolName', toolNameFilter)
		if (statusFilter) params.set('status', statusFilter)
		if (versionFilter) params.set('version', versionFilter)
		if (showFailuresOnly) params.set('status', 'failure')
		params.set('limit', limit.toString())
		params.set('offset', offset.toString())

		goto(`?${params}`, { keepFocus: true })
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

<div class="page">
	<h1>Tool Runs Browser</h1>

	<div class="filters">
		<h2>Filters</h2>

		<div class="filter-grid">
			<div class="filter-group">
				<label for="hostname">Hostname (Customer)</label>
				<input id="hostname" type="text" bind:value={hostname} placeholder="e.g., acme-corp" />
			</div>

			<div class="filter-group">
				<label for="companyCode">Company Code</label>
				<input id="companyCode" type="text" bind:value={companyCode} placeholder="e.g., 123" />
			</div>

			<div class="filter-group">
				<label for="appName">App Name</label>
				<select id="appName" bind:value={appName}>
					<option value="">All</option>
					{#each appNameItems as name}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="level">Log Level</label>
				<select id="level" bind:value={level}>
					<option value="">All Levels</option>
					<option value="info">Info</option>
					<option value="error">Error</option>
					<option value="warn">Warn</option>
					<option value="debug">Debug</option>
				</select>
			</div>

			<div class="filter-group">
				<label for="toolName">Tool Name</label>
				<input
					id="toolName"
					type="text"
					bind:value={toolNameFilter}
					placeholder="e.g., query_graphql"
				/>
			</div>

			<div class="filter-group">
				<label for="version">MCP Version</label>
				<input id="version" type="text" bind:value={versionFilter} placeholder="e.g., 0.2.0" />
			</div>

			<div class="filter-group">
				<label for="textSearch">Text Search</label>
				<input
					id="textSearch"
					type="text"
					bind:value={textSearch}
					placeholder="Search in messages"
				/>
			</div>
		</div>
	</div>

	<div class="filter-actions">
		<label>
			<input type="checkbox" bind:checked={showFailuresOnly} />
			Show Failures Only
		</label>

		<button onclick={handleSearch} disabled={loading}>
			{loading ? 'Searching...' : 'Search'}
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<!-- Results Table -->
	<div class="results">
		<h2>Results ({toolRuns.length} tool runs)</h2>

		{#if loading}
			<p>Loading...</p>
		{:else if toolRuns.length === 0}
			<p>No tool runs found. Try adjusting your filters.</p>
		{:else}
			<table class="tool-runs-table">
				<thead>
					<tr>
						<th>Timestamp</th>
						<th>Tool</th>
						<th>Status</th>
						<th>Duration</th>
						<th>Version</th>
						<th>Hostname</th>
						<th>User Context Preview</th>
					</tr>
				</thead>
				<tbody>
					{#each toolRuns as run (run.id)}
						<tr onclick={() => (selectedRun = run)} class="clickable">
							<td>{formatTimestamp(run.timestamp)}</td>
							<td class="tool-name">{run.toolName}</td>
							<td>
								<span class="badge {getStatusBadgeClass(run.status)}">
									{run.status}
								</span>
							</td>
							<td>{formatDuration(run.durationMs)}</td>
							<td>
								{#if run.mcpVersion}
									<span class="version-badge">{run.mcpVersion}</span>
								{/if}
							</td>
							<td>{run.hostname}</td>
							<td class="user-preview"
								>{run.userContext ? run.userContext.substring(0, 75) + '...' : 'N/A'}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>

			<div class="pagination">
				<button onclick={prevPage} disabled={offset === 0 || loading}> Previous </button>
				<span>Showing {offset + 1} - {offset + toolRuns.length}</span>
				<button onclick={nextPage} disabled={!hasMore || loading}> Next </button>
			</div>
		{/if}
	</div>
</div>

<!-- Detail Modal -->
{#if selectedRun}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={() => (selectedRun = null)}
		onkeydown={(e) => e.key === 'Escape' && (selectedRun = null)}
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
				<button class="close-btn" onclick={() => (selectedRun = null)}>×</button>
			</div>

			<div class="modal-body">
				<div class="detail-section">
					<h3>Basic Info</h3>
					<dl>
						<dt>ID:</dt>
						<dd>{selectedRun.id}</dd>
						<dt>Timestamp:</dt>
						<dd>{formatTimestamp(selectedRun.timestamp)}</dd>
						<dt>Tool Name:</dt>
						<dd>{selectedRun.toolName}</dd>
						<dt>Status:</dt>
						<dd>
							<span class="badge {getStatusBadgeClass(selectedRun.status)}">
								{selectedRun.status}
							</span>
						</dd>
						<dt>Duration:</dt>
						<dd>{formatDuration(selectedRun.durationMs)}</dd>
						<dt>Version:</dt>
						<dd>{selectedRun.mcpVersion}</dd>
					</dl>
				</div>

				<div class="detail-section">
					<h3>Context</h3>
					<dl>
						<dt>Session ID:</dt>
						<dd class="monospace session-id-row">
							{selectedRun.sessionId}
							<a
								href="/sessions/{selectedRun.sessionId}"
								class="session-link"
								title="View session details"
								onclick={(e) => {
									e.stopPropagation()
									if (selectedRun) {
										goto(`/sessions/${selectedRun.sessionId}`)
									}
								}}
							>
								<i class="fa fa-external-link" aria-hidden="true"></i>
							</a>
						</dd>
						<dt>Hostname:</dt>
						<dd>{selectedRun.hostname}</dd>
						<dt>Company Code:</dt>
						<dd>{selectedRun.companyCode}</dd>
						<dt>App Name:</dt>
						<dd>{selectedRun.appName}</dd>
					</dl>
				</div>

				<div class="detail-section">
					<h3>User Context</h3>
					<pre class="code-block">{selectedRun.userContext}</pre>
				</div>

				{#if selectedRun.status === 'failure' && selectedRun.errorClass}
					<div class="detail-section error-section">
						<h3>Error Details</h3>
						<dl>
							<dt>Error Class:</dt>
							<dd>{selectedRun.errorClass}</dd>
						</dl>
					</div>
				{/if}

				<div class="detail-section">
					<h3>Result ({selectedRun.resultKind})</h3>
					<pre class="code-block">{selectedRun.resultText}</pre>
				</div>

				<div class="detail-section">
					<h3>GraphQL Metadata</h3>
					<dl>
						<dt>GQL Calls:</dt>
						<dd>{selectedRun.gqlCount}</dd>
						<dt>Max GQL Time:</dt>
						<dd>
							{selectedRun.gqlMaxTimeMs ? `${selectedRun.gqlMaxTimeMs}ms` : 'N/A'}
						</dd>
					</dl>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 2rem;
	}

	.filters {
		background: #f5f5f5;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.filters h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
	}

	.filter-group label {
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.filter-group input,
	.filter-group select {
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.filter-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.filter-actions label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-actions button {
		padding: 0.5rem 1.5rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.filter-actions button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.error {
		background: #fee;
		color: #c00;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.results h2 {
		margin-bottom: 1rem;
	}

	.tool-runs-table {
		width: 100%;
		border-collapse: collapse;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tool-runs-table th,
	.tool-runs-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid #eee;
	}

	.tool-runs-table th {
		background: #f8f9fa;
		font-weight: 600;
		position: sticky;
		top: 0;
	}

	.tool-runs-table tr.clickable {
		cursor: pointer;
	}

	.tool-runs-table tr.clickable:hover {
		background: #f8f9fa;
	}

	.tool-name {
		font-family: monospace;
		font-weight: 500;
	}

	.user-preview {
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		padding: 1rem;
	}

	.pagination button {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
	}

	.pagination button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Modal Styles */
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

	.detail-section {
		margin-bottom: 1.5rem;
	}

	.detail-section h3 {
		margin-top: 0;
		margin-bottom: 0.75rem;
		color: #333;
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
	}

	.monospace {
		font-family: monospace;
		font-size: 0.875rem;
	}

	.session-id-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.code-block {
		background: #f5f5f5;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		font-family: monospace;
		font-size: 0.875rem;
		white-space: pre-wrap;
		word-wrap: break-word;
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
