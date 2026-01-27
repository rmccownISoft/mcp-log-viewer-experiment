# Milestone 3: Prompt Summary & Version Compare 📊

## 🎯 What You're Building

An aggregation and comparison interface that groups identical user prompts (user contexts) together and shows how they perform across different MCP versions. This is your A/B testing dashboard for understanding which versions handle specific prompts better.

**Mental Model**: Think of this as going from individual transactions to aggregate analytics. Instead of looking at each tool run separately (Milestone 2), you're now asking "How did this exact prompt perform across 50 different runs?" and "Did version 0.2.0 handle it better than 0.1.5?"

## 🧩 How This Works

### The Data Flow

```
User visits /prompts → Page loads with filters →
+page.server.ts queries tool runs →
Group by exact userContext string →
Calculate aggregate stats per prompt →
Display grouped table →
User clicks "Compare Versions" →
Sub-group by mcpVersion →
Show side-by-side comparison →
Link to example runs
```

### Key Concept: Grouping vs. Filtering

- **Milestone 2**: Show individual tool runs in a flat list
- **Milestone 3**: Group runs by `userContext` and show statistics
  - How many times was this prompt used?
  - What's the success rate?
  - Average duration?
  - Which versions handled it?

### Why This Matters

When you're evaluating MCP versions:

1. Same prompt might be executed 50 times across different sessions
2. Version 0.1.5 might have 80% success rate
3. Version 0.2.0 might have 95% success rate
4. This view helps you spot those patterns instantly

## 📊 What You'll Build

### Frontend: `/prompts`

- **Filter panel** with:
  - Hostname (customer)
  - Tool Name
  - Date range
  - Minimum occurrences (e.g., "only show prompts used 5+ times")
- **Grouped table** showing:
  - User Context (preview)
  - Tool Name
  - Total Runs
  - Success Rate
  - Avg Duration
  - Versions Used
  - Actions (Compare, View Examples)
- **Version comparison modal**:
  - Side-by-side stats per version
  - Success rate comparison
  - Duration comparison
  - Link to example runs
- **Example runs modal**:
  - List of actual tool runs for this prompt
  - Click to see full details

### Backend: Two API routes

1. `/api/prompts/summary` - Get grouped prompt statistics
2. `/api/compare/user-context` - Compare one prompt across versions

## 🏗️ Step-by-Step Implementation

---

### Step 1: Define Aggregation Types

**File**: `src/lib/server/types.ts`

Add these interfaces (alongside your existing types):

```typescript
export interface PromptSummary {
	// The unique prompt text
	userContext: string

	// Which tool this prompt is for
	toolName: string

	// Aggregated statistics
	totalRuns: number
	successCount: number
	failureCount: number
	successRate: number // 0-100

	// Performance metrics
	avgDurationMs: number | null
	minDurationMs: number | null
	maxDurationMs: number | null

	// Version info
	versionsUsed: string[] // Unique list of MCP versions

	// Example runs for drill-down
	exampleRunIds: number[] // First few run IDs
}

export interface VersionComparison {
	userContext: string
	toolName: string

	// Stats per version
	byVersion: {
		version: string
		totalRuns: number
		successCount: number
		failureCount: number
		successRate: number
		avgDurationMs: number | null
		exampleRunIds: number[]
	}[]
}
```

---

### Step 2: Create Aggregation Helpers

**File**: `src/lib/server/aggregators.ts` (new file)

Create helper functions for grouping and calculating stats:

```typescript
import type { ToolRun, PromptSummary, VersionComparison } from './types'

/**
 * Group tool runs by userContext and calculate summary statistics
 */
export function aggregateByPrompt(toolRuns: ToolRun[]): PromptSummary[] {
	// Group by userContext + toolName combination
	const groups = new Map<string, ToolRun[]>()

	for (const run of toolRuns) {
		const key = `${run.toolName}::${run.userContext}`
		if (!groups.has(key)) {
			groups.set(key, [])
		}
		groups.get(key)!.push(run)
	}

	// Calculate stats for each group
	const summaries: PromptSummary[] = []

	for (const [key, runs] of groups.entries()) {
		const [toolName, userContext] = key.split('::', 2)

		const successCount = runs.filter((r) => r.status === 'success').length
		const failureCount = runs.filter((r) => r.status === 'failure').length

		// Calculate duration stats (only for runs with duration data)
		const durationsMs = runs.map((r) => r.durationMs).filter((d): d is number => d !== null)

		const avgDurationMs =
			durationsMs.length > 0
				? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
				: null

		const minDurationMs = durationsMs.length > 0 ? Math.min(...durationsMs) : null

		const maxDurationMs = durationsMs.length > 0 ? Math.max(...durationsMs) : null

		// Collect unique versions
		const versionsUsed = [
			...new Set(runs.map((r) => r.mcpVersion).filter((v): v is string => v !== null))
		].sort()

		// Get example run IDs (first 5)
		const exampleRunIds = runs.slice(0, 5).map((r) => r.id)

		summaries.push({
			userContext,
			toolName,
			totalRuns: runs.length,
			successCount,
			failureCount,
			successRate: runs.length > 0 ? (successCount / runs.length) * 100 : 0,
			avgDurationMs: avgDurationMs ? Math.round(avgDurationMs) : null,
			minDurationMs,
			maxDurationMs,
			versionsUsed,
			exampleRunIds
		})
	}

	// Sort by total runs descending
	return summaries.sort((a, b) => b.totalRuns - a.totalRuns)
}

/**
 * Compare a specific prompt across different MCP versions
 */
export function compareByVersion(
	toolRuns: ToolRun[],
	userContext: string,
	toolName: string
): VersionComparison | null {
	// Filter to just this prompt
	const matchingRuns = toolRuns.filter(
		(r) => r.userContext === userContext && r.toolName === toolName
	)

	if (matchingRuns.length === 0) {
		return null
	}

	// Group by version
	const byVersionMap = new Map<string, ToolRun[]>()

	for (const run of matchingRuns) {
		const version = run.mcpVersion || 'unknown'
		if (!byVersionMap.has(version)) {
			byVersionMap.set(version, [])
		}
		byVersionMap.get(version)!.push(run)
	}

	// Calculate stats per version
	const byVersion = Array.from(byVersionMap.entries()).map(([version, runs]) => {
		const successCount = runs.filter((r) => r.status === 'success').length
		const failureCount = runs.filter((r) => r.status === 'failure').length

		const durationsMs = runs.map((r) => r.durationMs).filter((d): d is number => d !== null)

		const avgDurationMs =
			durationsMs.length > 0
				? Math.round(durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length)
				: null

		const exampleRunIds = runs.slice(0, 3).map((r) => r.id)

		return {
			version,
			totalRuns: runs.length,
			successCount,
			failureCount,
			successRate: runs.length > 0 ? (successCount / runs.length) * 100 : 0,
			avgDurationMs,
			exampleRunIds
		}
	})

	// Sort by version string
	byVersion.sort((a, b) => a.version.localeCompare(b.version))

	return {
		userContext,
		toolName,
		byVersion
	}
}
```

---

### Step 3: Create Prompt Summary API

**File**: `src/routes/api/prompts/summary/+server.ts`

```typescript
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getPool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import { aggregateByPrompt } from '$lib/server/aggregators'

export const GET: RequestHandler = async ({ url }) => {
	const pool = getPool()

	// Parse query parameters
	const hostname = url.searchParams.get('hostname') || ''
	const toolName = url.searchParams.get('toolName') || ''
	const minOccurrences = parseInt(url.searchParams.get('minOccurrences') || '1')
	const limit = parseInt(url.searchParams.get('limit') || '1000') // Fetch more for aggregation

	try {
		// Build SQL query - similar to tool-runs but we need more data
		let sql = 'SELECT * FROM errsole_logs_v3 WHERE 1=1'
		const params: any[] = []

		// Basic filters
		if (hostname) {
			sql += ' AND hostname = ?'
			params.push(hostname)
		}

		// Add date range filter if provided
		const startDate = url.searchParams.get('startDate')
		const endDate = url.searchParams.get('endDate')

		if (startDate) {
			sql += ' AND timestamp >= ?'
			params.push(startDate)
		}

		if (endDate) {
			sql += ' AND timestamp <= ?'
			params.push(endDate)
		}

		// Order and limit
		sql += ' ORDER BY timestamp DESC LIMIT ?'
		params.push(limit)

		// Execute query
		const [rows] = await pool.execute(sql, params)

		// Parse all rows into ToolRuns
		const toolRuns = (rows as any[])
			.map(parseToolRun)
			.filter((run): run is NonNullable<typeof run> => run !== null)

		// Apply post-query filters
		let filtered = toolRuns

		if (toolName) {
			filtered = filtered.filter((r) => r.toolName.toLowerCase().includes(toolName.toLowerCase()))
		}

		// Aggregate by prompt
		const summaries = aggregateByPrompt(filtered)

		// Filter by minimum occurrences
		const finalSummaries = summaries.filter((s) => s.totalRuns >= minOccurrences)

		return json({
			summaries: finalSummaries,
			total: finalSummaries.length
		})
	} catch (error) {
		console.error('Error fetching prompt summaries:', error)
		return json({ error: 'Failed to fetch prompt summaries' }, { status: 500 })
	}
}
```

---

### Step 4: Create Version Comparison API

**File**: `src/routes/api/compare/user-context/+server.ts`

```typescript
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getPool } from '$lib/server/db'
import { parseToolRun } from '$lib/server/parsers'
import { compareByVersion } from '$lib/server/aggregators'

export const GET: RequestHandler = async ({ url }) => {
	const pool = getPool()

	// Required parameters
	const userContext = url.searchParams.get('userContext')
	const toolName = url.searchParams.get('toolName')

	if (!userContext || !toolName) {
		return json({ error: 'userContext and toolName are required' }, { status: 400 })
	}

	const hostname = url.searchParams.get('hostname') || ''

	try {
		// Query for this specific userContext
		// We search in message since userContext is in meta
		let sql = `
      SELECT * FROM errsole_logs_v3 
      WHERE message LIKE CONCAT('%', ?, '%')
    `
		const params: any[] = [userContext.slice(0, 50)] // Use first 50 chars for search

		if (hostname) {
			sql += ' AND hostname = ?'
			params.push(hostname)
		}

		sql += ' ORDER BY timestamp DESC LIMIT 500'

		const [rows] = await pool.execute(sql, params)

		// Parse into tool runs
		const toolRuns = (rows as any[])
			.map(parseToolRun)
			.filter((run): run is NonNullable<typeof run> => run !== null)

		// Compare by version
		const comparison = compareByVersion(toolRuns, userContext, toolName)

		if (!comparison) {
			return json({ error: 'No runs found for this prompt' }, { status: 404 })
		}

		return json(comparison)
	} catch (error) {
		console.error('Error comparing versions:', error)
		return json({ error: 'Failed to compare versions' }, { status: 500 })
	}
}
```

---

### Step 5: Create the Frontend Page

**File**: `src/routes/prompts/+page.svelte`

```svelte
<script lang="ts">
  import type { PromptSummary, VersionComparison } from '$lib/server/types';

  // Reactive state
  let filters = $state({
    hostname: '',
    toolName: '',
    minOccurrences: 1
  });

  let summaries = $state<PromptSummary[]>([]);
  let loading = $state(false);
  let error = $state('');

  // Modal state
  let selectedPrompt = $state<PromptSummary | null>(null);
  let versionComparison = $state<VersionComparison | null>(null);
  let loadingComparison = $state(false);

  // Fetch summaries
  async function fetchSummaries() {
    loading = true;
    error = '';

    const params = new URLSearchParams();
    if (filters.hostname) params.set('hostname', filters.hostname);
    if (filters.toolName) params.set('toolName', filters.toolName);
    if (filters.minOccurrences > 1) params.set('minOccurrences', String(filters.minOccurrences));

    try {
      const response = await fetch(`/api/prompts/summary?${params}`);
      const data = await response.json();

      if (response.ok) {
        summaries = data.summaries;
      } else {
        error = data.error || 'Failed to fetch summaries';
      }
    } catch (err) {
      error = 'Network error';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Load version comparison
  async function compareVersions(prompt: PromptSummary) {
    selectedPrompt = prompt;
    loadingComparison = true;

    const params = new URLSearchParams({
      userContext: prompt.userContext,
      toolName: prompt.toolName
    });

    if (filters.hostname) {
      params.set('hostname', filters.hostname);
    }

    try {
      const response = await fetch(`/api/compare/user-context?${params}`);
      const data = await response.json();

      if (response.ok) {
        versionComparison = data;
      } else {
        error = data.error || 'Failed to compare versions';
      }
    } catch (err) {
      error = 'Network error';
      console.error(err);
    } finally {
      loadingComparison = false;
    }
  }

  // Close modal
  function closeModal() {
    selectedPrompt = null;
    versionComparison = null;
  }

  // Truncate long text
  function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }

  // Format percentage
  function formatPercent(rate: number): string {
    return `${rate.toFixed(1)}%`;
  }

  // Initial load
  fetchSummaries();
</script>

<div class="container">
  <h1>Prompt Summary & Comparison</h1>

  <p class="description">
    See which prompts (user contexts) are used most frequently, their success rates,
    and compare performance across different MCP versions.
  </p>

  <!-- Filters -->
  <div class="filter-panel">
    <h2>Filters</h2>

    <div class="filter-grid">
      <div class="filter-group">
        <label for="hostname">Hostname (Customer)</label>
        <input
          id="hostname"
          type="text"
          bind:value={filters.hostname}
          placeholder="e.g., acme-corp"
        />
      </div>

      <div class="filter-group">
        <label for="toolName">Tool Name</label>
        <input
          id="toolName"
          type="text"
          bind:value={filters.toolName}
          placeholder="e.g., search_contacts"
        />
      </div>

      <div class="filter-group">
        <label for="minOccurrences">Min. Occurrences</label>
        <input
          id="minOccurrences"
          type="number"
          bind:value={filters.minOccurrences}
          min="1"
          placeholder="1"
        />
      </div>
    </div>

    <div class="filter-actions">
      <button onclick={fetchSummaries} disabled={loading}>
        {loading ? 'Loading...' : 'Search'}
      </button>
      <button
        onclick={() => {
          filters = { hostname: '', toolName: '', minOccurrences: 1 };
          fetchSummaries();
        }}
        disabled={loading}
      >
        Reset
      </button>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <!-- Results -->
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
                  <span class="success-rate" class:high={summary.successRate >= 90} class:medium={summary.successRate >= 70 && summary.successRate < 90} class:low={summary.successRate < 70}>
                    {formatPercent(summary.successRate)}
                  </span>
                  <div class="count-detail">
                    {summary.successCount} / {summary.failureCount} / {summary.totalRuns - summary.successCount - summary.failureCount}
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
                  <button
                    class="btn-small"
                    onclick={() => compareVersions(summary)}
                  >
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

<!-- Version Comparison Modal -->
{#if selectedPrompt && versionComparison}
  <div class="modal-overlay" onclick={closeModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
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
                      <span class="success-rate" class:high={versionData.successRate >= 90} class:medium={versionData.successRate >= 70 && versionData.successRate < 90} class:low={versionData.successRate < 70}>
                        {formatPercent(versionData.successRate)}
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
              {@const sorted = [...versionComparison.byVersion].sort((a, b) => b.successRate - a.successRate)}
              {@const best = sorted[0]}
              {@const worst = sorted[sorted.length - 1]}

              <div class="insight-box">
                <p>
                  <strong>Best performing:</strong>
                  <code>{best.version}</code> with {formatPercent(best.successRate)} success rate
                </p>
                {#if best.version !== worst.version}
                  <p>
                    <strong>Worst performing:</strong>
                    <code>{worst.version}</code> with {formatPercent(worst.successRate)} success rate
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
    max-width: 1400px;
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
    background: #f9f9f9;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .filter-panel h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.25rem;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
  }

  .filter-group label {
    font-weight: 600;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  .filter-group input,
  .filter-group select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .filter-actions {
    display: flex;
    gap: 1rem;
  }

  .filter-actions button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    background: #007bff;
    color: white;
    font-weight: 600;
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
</style>
```

---

### Step 6: Add Navigation Link

**File**: `src/routes/+layout.svelte`

Update your layout to include the prompts page:

```svelte
<!-- Add to your existing nav -->
<nav>
  <a href="/">Home</a>
  <a href="/sessions">Sessions</a>
  <a href="/tool-runs">Tool Runs</a>
  <a href="/prompts">Prompts</a>
</nav>
```

---

## 🧪 Testing Your Implementation

### Test Scenarios

1. **Basic prompt grouping**:

   - Visit `/prompts`
   - Should see prompts grouped by userContext
   - Each row shows aggregate stats

2. **Filter by tool name**:

   - Enter "search" in tool name filter
   - Click "Search"
   - Should only see prompts for search-related tools

3. **Minimum occurrences filter**:

   - Set "Min. Occurrences" to 5
   - Click "Search"
   - Should only see prompts used 5+ times

4. **Version comparison**:

   - Click "Compare Versions" on any row
   - Modal opens with side-by-side stats
   - Should see different versions listed
   - Success rates should be calculated correctly

5. **Insights generation**:

   - In version comparison modal
   - Should highlight best/worst performing versions
   - Should show percentage point improvement

6. **Example links**:
   - Click "View examples" link in comparison modal
   - Should open `/tool-runs` page filtered to those specific runs

### SQL to Verify Data

```sql
-- Check for prompts with multiple versions
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(meta, '$.tool.name')) as tool_name,
  JSON_UNQUOTE(JSON_EXTRACT(meta, '$.tool.userContext')) as user_context,
  JSON_UNQUOTE(JSON_EXTRACT(meta, '$.gql[0].headers.User-Agent')) as version,
  COUNT(*) as count
FROM errsole_logs_v3
WHERE meta LIKE '%"tool":%'
GROUP BY tool_name, user_context, version
HAVING count > 1
ORDER BY count DESC
LIMIT 10;

-- Check success rates
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(meta, '$.tool.name')) as tool_name,
  SUM(CASE WHEN JSON_EXTRACT(meta, '$.tool.result.isError') = true THEN 1 ELSE 0 END) as failures,
  SUM(CASE WHEN JSON_EXTRACT(meta, '$.tool.result.isError') = true THEN 0 ELSE 1 END) as successes,
  COUNT(*) as total
FROM errsole_logs_v3
WHERE meta LIKE '%"tool":%'
GROUP BY tool_name;
```

---

## 🎯 Success Criteria

You've completed Milestone 3 when:

- ✅ `/prompts` page loads with filter panel
- ✅ Can filter by hostname, tool name, minimum occurrences
- ✅ Prompts are grouped by exact userContext string
- ✅ Table shows total runs, success rate, avg duration, versions
- ✅ Success rates color-coded (green/yellow/red)
- ✅ "Compare Versions" button opens modal
- ✅ Version comparison shows stats per version
- ✅ Insights section highlights best/worst versions
- ✅ Links to example runs work
- ✅ Modal displays user context in full

---

## 🐛 Common Issues & Fixes

### No summaries showing

- Check that you have tool runs with the same userContext multiple times
- Run the SQL test queries to verify groupable data exists
- Check browser console for errors

### Aggregation math seems wrong

- Verify `aggregateByPrompt` is counting correctly
- Check that success/failure detection works (`extractToolStatus`)
- Console.log the intermediate groups to debug

### Version comparison empty

- Verify the userContext and toolName are being passed correctly
- Check that `compareByVersion` is filtering properly
- Make sure `mcpVersion` extraction is working (check parsers)

### Modal doesn't open

- Check that `compareVersions()` is called correctly
- Verify `selectedPrompt` and `versionComparison` state
- Check for JavaScript errors in console

### Performance slow

- Reduce the `limit` in the API route (default is 1000)
- Add more specific filters (hostname, date range)
- Consider the v2 derived table approach for large datasets

---

## 💡 What You Learned

- **Data aggregation**: Grouping and calculating statistics from raw data
- **Multi-level grouping**: First by prompt, then by version
- **Derived metrics**: Calculating success rates, averages from collections
- **Comparison UIs**: Side-by-side comparison patterns
- **Modal interactions**: Loading data on-demand for detailed views
- **Type safety with aggregates**: TypeScript interfaces for complex data shapes
- **Map/reduce patterns**: Using Map for efficient grouping in JavaScript

---

## 🚀 Next Steps

Ready for **Milestone 4: Data Export**? You'll learn to:

- Generate CSV files from aggregated data
- Create JSONL exports for ML pipelines
- Stream large datasets efficiently
- Add download buttons to existing pages
- Handle different export formats

---

## 📝 Quick Reference

### Key Files Created/Modified

- ✅ `src/lib/server/types.ts` - Added PromptSummary and VersionComparison
- ✅ `src/lib/server/aggregators.ts` - New file with aggregation logic
- ✅ `src/routes/api/prompts/summary/+server.ts` - Summary API
- ✅ `src/routes/api/compare/user-context/+server.ts` - Comparison API
- ✅ `src/routes/prompts/+page.svelte` - Frontend page
- ✅ `src/routes/+layout.svelte` - Navigation link

### Important Patterns

- Use `Map` for efficient grouping by composite keys
- Filter data twice: once in SQL (basic), then in Node (advanced)
- Calculate aggregate metrics from arrays (reduce, filter, map)
- Store comparison state separately from summary state
- Link to other pages with query parameters for drill-down

### Key Aggregation Formula

```typescript
// Success rate calculation
const successRate = (successCount / totalRuns) * 100

// Average duration (filter null values first)
const durationsMs = runs.map((r) => r.durationMs).filter((d) => d !== null)
const avgDurationMs = durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
```

---

Need help? Review the aggregation helpers or check how Milestone 2 handled filtering for comparison patterns!
