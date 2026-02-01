<script lang="ts">
	import type { PromptSummary, VersionComparison } from '$lib/server/types'

	let { data } = $props()
	// TODO: this probably shouldn't be an obj, will its properties affect state change?
	let filters = $state({
		companyCode: '',
		toolName: '',
		minOccurrences: 1,
		appName: '',
		limit: 10000
	})

	//let summaries = $state<PromptSummary[]>(data.summaries)
	let summaries = $derived(data.summaries)
	let appNameItems = $derived(data.appNames || [])
	let loading = $state(false)
	let error = $state('')

	// Modal state
	let selectedPrompt = $state<PromptSummary | null>(null)
	let versionComparison = $state<VersionComparison | null>(null)
	let loadingComparison = $state(false)

	// Fetch summaries
	async function fetchSummaries() {
		loading = true
		error = ''

		const params = new URLSearchParams()
		if (filters.companyCode) {
			params.set('companyCode', filters.companyCode)
		}
		if (filters.toolName) {
			params.set('toolName', filters.toolName)
		}
		if (filters.minOccurrences > 1) {
			params.set('minOccurrences', String(filters.minOccurrences))
		}
		if (filters.appName) {
			params.set('appName', filters.appName)
		}
		if (filters.limit) {
			params.set('limit', String(filters.limit))
		}
		// Handle fetch, set loading flag
		try {
			const response = await fetch(`/api/prompts/summary?${params}`)
			const data = await response.json()

			if (response.ok) {
				summaries = data.summaries
			} else {
				error = data.error || 'Failed to fetch summaries'
			}
		} catch (err) {
			error = 'Network error'
			console.error(err)
		} finally {
			loading = false
		}
	}

	// Load version comparison
	async function compareVersions(prompt: PromptSummary) {
		selectedPrompt = prompt
		loadingComparison = true

		const params = new URLSearchParams({
			userContext: prompt.userContext,
			toolName: prompt.toolName
		})

		if (filters.companyCode) {
			params.set('companyCode', filters.companyCode)
		}

		try {
			const response = await fetch(`/api/compare/user-context?${params}`)
			const data = await response.json()

			if (response.ok) {
				versionComparison = data
			} else {
				error = data.error || 'Failed to compare versions'
			}
		} catch (err) {
			error = 'Network error'
			console.error(err)
		} finally {
			loadingComparison = false
		}
	}

	function closeModal() {
		selectedPrompt = null
		versionComparison = null
	}

	function handleModalOverlayKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			closeModal()
		}
	}

	function truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text
		return text.slice(0, maxLength) + '...'
	}

	function formatPercentage(rate: number | undefined | null): string {
		if (rate == null || isNaN(rate)) {
			return '0.0%'
		}
		return `${rate.toFixed(1)}%`
	}
</script>

<div class="container">
	<h1>Prompt Summary & Comparison</h1>

	<p class="description">
		See which prompts (user contexts) are used most frequently, their success rates, and compare
		performance across different MCP versions.
	</p>

	<div class="filter-panel">
		<h2>Filters</h2>

		<div class="filter-grid">
			<div class="filter-group">
				<label for="companyCode">Company Code</label>

				<input
					id="companyCode"
					type="text"
					bind:value={filters.companyCode}
					placeholder="e.g., stuff"
				/>
			</div>
			<div class="filter-group">
				<label for="appName">App Name</label>
				<select id="appName" bind:value={filters.appName}>
					<option value="">All</option>
					{#each appNameItems as appName}
						<option value={appName}>{appName}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<label for="toolName">Tool Name</label>
				<input
					id="toolName"
					type="text"
					bind:value={filters.toolName}
					placeholder="e.g., get_customers"
				/>
			</div>
			<div class="filter-group">
				<label for="minOccurrences">Min Occurrences</label>
				<input
					id="minOccurrences"
					type="number"
					bind:value={filters.minOccurrences}
					min="1"
					placeholder="1"
				/>
			</div>
			<div class="filter-group">
				<label for="limit">Result Limit</label>
				<input
					id="limit"
					type="number"
					bind:value={filters.limit}
					min="100"
					max="50000"
					step="1000"
					placeholder="10000"
				/>
			</div>

			<div class="filter-actions">
				<button onclick={fetchSummaries} disabled={loading}>
					{loading ? 'Loading...' : 'Search'}
				</button>
				<button
					onclick={() => {
						filters = {
							companyCode: '',
							toolName: '',
							minOccurrences: 1,
							appName: '',
							limit: 10000
						}
						fetchSummaries()
					}}
					disabled={loading}
					>Reset
				</button>
			</div>
		</div>
	</div>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<div class="results">
		<h2>Prompt Summaries ({summaries.length})</h2>

		{#if summaries.length === 0 && !loading}
			<p class="no-results">No prompts found matching your criteria.</p>
		{:else}
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>User Context Preview</th>
							<th>Tool</th>
							<th>Total Runs</th>
							<th>Success Rate</th>
							<th>Avg Duration</th>
							<th>Versions</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each summaries as summary}
							<tr>
								<td>
									<div class="user-context-preview" title={summary.userContext}>
										{truncate(summary.userContext, 80)}
									</div>
								</td>
								<td>
									<code class="tool-name">{summary.toolName}</code>
								</td>
								<td class="text-center">{summary.totalRuns}</td>
								<td>
									<span
										class="success-rate"
										class:high={summary.successRate >= 90}
										class:medium={summary.successRate >= 70 && summary.successRate < 90}
										class:low={summary.successRate < 70}
									>
										{formatPercentage(summary.successRate)}
									</span>
									<div class="count-detail">
										{summary.successCount} / {summary.failureCount} / {summary.totalRuns -
											summary.successCount -
											summary.failureCount}
									</div>
								</td>
								<td class="text-center">
									{#if summary.avgDurationMs}
										{summary.avgDurationMs.toLocaleString()}ms
									{:else}
										-
									{/if}
								</td>
								<td>
									<div class="versions">
										{#each summary.versionsUsed.slice(0, 3) as version}
											<span class="version-badge">{version}</span>
										{/each}
										{#if summary.versionsUsed.length > 3}
											<span class="version-more">+{summary.versionsUsed.length - 3}</span>
										{/if}
									</div>
								</td>
								<td>
									<button class="btn-small" onclick={() => compareVersions(summary)}>
										Compare Versions
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

{#if selectedPrompt && versionComparison}
	<div
		class="modal-overlay"
		onclick={closeModal}
		onkeydown={handleModalOverlayKeydown}
		role="button"
		tabindex="0"
		aria-label="Close modal"
	>
		<!-- svelte-ignore a11y_interactive_supports_focus (because of reasons) -->
		<div
			class="modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<div class="modal-header">
				<h2>Version Comparison: {selectedPrompt.toolName}</h2>
				<button class="close-btn" onclick={closeModal}>&times;</button>
			</div>

			<div class="modal-body">
				{#if loadingComparison}
					<p>Loading comparison...</p>
				{:else}
					<!-- User Context -->
					<div class="detail-section">
						<h3>User Context</h3>
						<div class="code-block">{versionComparison.userContext}</div>
					</div>

					<!-- Comparison Table -->
					<div class="detail-section">
						<h3>Performance by Version</h3>
						<table class="comparison-table">
							<thead>
								<tr>
									<th>Version</th>
									<th>Total Runs</th>
									<th>Success Rate</th>
									<th>Avg Duration</th>
									<th>Examples</th>
								</tr>
							</thead>
							<tbody>
								{#each versionComparison.byVersion as versionData}
									<tr>
										<td><code>{versionData.version}</code></td>
										<td class="text-center">{versionData.totalRuns}</td>
										<td>
											<span
												class="success-rate"
												class:high={versionData.successRate >= 90}
												class:medium={versionData.successRate >= 70 && versionData.successRate < 90}
												class:low={versionData.successRate < 70}
											>
												{formatPercentage(versionData.successRate)}
											</span>
											<div class="count-detail">
												{versionData.successCount} success / {versionData.failureCount} fail
											</div>
										</td>
										<td class="text-center">
											{#if versionData.avgDurationMs}
												{versionData.avgDurationMs.toLocaleString()}ms
											{:else}
												-
											{/if}
										</td>
										<td>
											<a href="/tool-runs?id={versionData.exampleRunIds.join(',')}" target="_blank">
												View {versionData.exampleRunIds.length} examples
											</a>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Insights -->
					<div class="detail-section">
						<h3>Insights</h3>
						{#if versionComparison.byVersion.length >= 2}
							{@const sorted = [...versionComparison.byVersion].sort(
								(a, b) => b.successRate - a.successRate
							)}
							{@const best = sorted[0]}
							{@const worst = sorted[sorted.length - 1]}

							<div class="insight-box">
								<p>
									<strong>Best performing:</strong>
									<code>{best.version}</code> with {formatPercentage(best.successRate)} success rate
								</p>
								{#if best.version !== worst.version}
									<p>
										<strong>Worst performing:</strong>
										<code>{worst.version}</code> with {formatPercentage(worst.successRate)} success rate
									</p>
									<p>
										<strong>Improvement:</strong>
										{(best.successRate - worst.successRate).toFixed(1)} percentage points
									</p>
								{/if}
							</div>
						{:else}
							<p>Not enough version data for comparison.</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1600px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		margin-bottom: 0.5rem;
	}

	.description {
		color: #666;
		margin-bottom: 2rem;
	}

	/* Filter Panel */
	.filter-panel {
		background: #f5f5f5;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.filter-panel h2 {
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

	.filter-actions button {
		padding: 0.5rem 1.5rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.filter-actions button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.filter-actions button:last-child {
		background: #6c757d;
	}

	/* Results */
	.results h2 {
		margin-bottom: 1rem;
	}

	.error-banner {
		background: #f8d7da;
		color: #721c24;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.no-results {
		text-align: center;
		padding: 2rem;
		color: #666;
	}

	/* Table */
	.table-container {
		overflow-x: auto;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: #f8f9fa;
	}

	th {
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid #dee2e6;
	}

	td {
		padding: 1rem;
		border-bottom: 1px solid #dee2e6;
	}

	tbody tr:hover {
		background: #f8f9fa;
	}

	.text-center {
		text-align: center;
	}

	.user-context-preview {
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: help;
	}

	.tool-name {
		background: #e9ecef;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.875rem;
	}

	.success-rate {
		font-weight: 600;
		font-size: 1.1rem;
	}

	.success-rate.high {
		color: #28a745;
	}

	.success-rate.medium {
		color: #ffc107;
	}

	.success-rate.low {
		color: #dc3545;
	}

	.count-detail {
		font-size: 0.75rem;
		color: #666;
		margin-top: 0.25rem;
	}

	.versions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.version-badge {
		background: #007bff;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: monospace;
	}

	.version-more {
		background: #6c757d;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.btn-small {
		padding: 0.5rem 1rem;
		border: 1px solid #007bff;
		background: white;
		color: #007bff;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.btn-small:hover {
		background: #007bff;
		color: white;
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
		max-width: 900px;
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

	.comparison-table {
		font-size: 0.9rem;
	}

	.comparison-table a {
		color: #007bff;
		text-decoration: none;
	}

	.comparison-table a:hover {
		text-decoration: underline;
	}

	.insight-box {
		background: #e7f3ff;
		padding: 1rem;
		border-left: 4px solid #007bff;
		border-radius: 4px;
	}

	.insight-box p {
		margin: 0.5rem 0;
	}

	.insight-box code {
		background: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	/* View Toggle */
	.view-toggle {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #dee2e6;
		padding-bottom: 0;
	}

	.view-tab {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 500;
		color: #6c757d;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: -2px;
	}

	.view-tab:hover {
		color: #007bff;
		background: #f8f9fa;
	}

	.view-tab.active {
		color: #007bff;
		border-bottom-color: #007bff;
		font-weight: 600;
	}

	.tab-icon {
		font-size: 1.2rem;
	}

	/* Full List View */
	.full-list-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.context-card {
		background: white;
		border: 1px solid #dee2e6;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: box-shadow 0.2s ease;
	}

	.context-card:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.context-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.context-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.tool-name-large {
		background: #007bff;
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-family: monospace;
		font-size: 1rem;
		font-weight: 600;
	}

	.run-count {
		background: #e9ecef;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #495057;
	}

	.success-rate-badge {
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.success-rate-badge.high {
		background: #d4edda;
		color: #155724;
	}

	.success-rate-badge.medium {
		background: #fff3cd;
		color: #856404;
	}

	.success-rate-badge.low {
		background: #f8d7da;
		color: #721c24;
	}

	.context-body {
		margin-bottom: 1rem;
	}

	.context-full-text {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 6px;
		font-family: monospace;
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
		border-left: 4px solid #007bff;
		max-height: 400px;
		overflow-y: auto;
	}

	.context-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 1rem;
		border-top: 1px solid #dee2e6;
	}

	.context-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.stat-item {
		font-size: 0.875rem;
		color: #6c757d;
		white-space: nowrap;
	}

	/* Tool Runs Table (Full List View) */
	.tool-runs-table .tool-name-cell {
		font-family: monospace;
		font-weight: 500;
		color: #007bff;
	}

	.tool-runs-table .user-context-cell {
		max-width: 400px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.875rem;
		color: #666;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.status-badge.success {
		background: #d4edda;
		color: #155724;
	}

	.status-badge.failure {
		background: #f8d7da;
		color: #721c24;
	}

	.status-badge.unknown {
		background: #fff3cd;
		color: #856404;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.context-header {
			flex-direction: column;
		}

		.context-meta {
			width: 100%;
		}

		.view-tab {
			padding: 0.5rem 1rem;
			font-size: 0.875rem;
		}

		.tab-icon {
			font-size: 1rem;
		}
	}
</style>
