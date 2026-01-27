<script lang="ts">
	import type { PromptSummary, VersionComparison } from '$lib/server/types'

	// TODO: this probably shouldn't be an obj, will its properties affect state change?
	let filters = $state({
		hostname: '',
		toolName: '',
		minOccurrences: 1
	})

	let summaries = $state<PromptSummary[]>([])
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
		if (filters.hostname) {
			params.set('hostname', filters.hostname)
		}
		if (filters.toolName) {
			params.set('toolName', filters.toolName)
		}
		if (filters.minOccurrences > 1) {
			params.set('minOccurrences', String(filters.minOccurrences))
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

		if (filters.hostname) {
			params.set('hostname', filters.hostname)
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

	function truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text
		return text.slice(0, maxLength) + '...'
	}

	function formatPercentage(rate: number): string {
		return `${rate.toFixed(1)}%`
	}

	// Initial load
	fetchSummaries()
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
				<label for="hostname">Hostname (Customer)</label>

				<input id="hostname" type="text" bind:value={filters.hostname} placeholder="e.g., stuff" />
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

			<div class="filter-actions">
				<button onclick={fetchSummaries} disabled={loading}>
					{loading ? 'Loading...' : 'Search'}
				</button>
				<button
					onclick={() => {
						filters = { hostname: '', toolName: '', minOccurrences: 1 }
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
										{formatPercent(summary.successRate)}
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
	<div class="modal-overlay" onclick={closeModal}>
		<div class="modal" onclick={(e) => e.stopPropagation()}></div>
	</div>
{/if}
