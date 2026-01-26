# Milestone 2: Tool Runs Browser 🔧

## 🎯 What You're Building

A powerful search and filter interface to browse ALL tool executions across all sessions. This is your main dashboard for understanding tool usage patterns, finding failures, and analyzing performance across customers and versions.

**Mental Model**: Think of this as a search engine for tool calls. Instead of looking at one session's timeline (Milestone 1), you're now searching across thousands of tool executions to find patterns, failures, and insights.

## 🧩 How This Works

### The Data Flow
```
User sets filters → Page loads with query params → 
+page.server.ts reads params → API route with filters → 
MySQL query (hostname, status, etc.) → 
Parse meta in Node → Filter tool runs → 
Transform to ToolRun objects → Return to page → 
Display in table + detail modal
```

### Key Difference from Milestone 1
- **Milestone 1**: Get all events for ONE session (simple WHERE sessionId)
- **Milestone 2**: Search ALL logs with multiple filters, then extract only tool runs

### Why Parse After Querying?
Since `meta` is stored as TEXT (not JSON type), we:
1. Query with simple filters (hostname, level, text search)
2. Pull back rows that *might* be tool runs
3. Parse `meta` in Node to identify actual tool runs
4. Apply additional filters (toolName, status, version)
5. Return paginated results

## 📊 What You'll Build

### Frontend: `/tool-runs`
- **Filter panel** with controls for:
  - Hostname (customer)
  - Company Code
  - App Name
  - Log Level
  - Text search (searches message field)
  - Quick filters: "Show Failures Only", "Show Tool Runs Only"
- **Results table** showing:
  - Timestamp
  - Tool Name
  - Status (success/failure badge)
  - Duration
  - Version
  - User preview
- **Detail modal** when clicking a row:
  - Full user context
  - Result preview
  - GraphQL calls made
  - Error details (if failed)

### Backend: `/api/tool-runs`
- Accept query parameters for filtering
- Query MySQL with basic filters
- Parse meta and extract tool runs only
- Apply additional filters
- Return paginated results

## 🏗️ Step-by-Step Implementation

---

### Step 1: Define ToolRun Type

**File**: `src/lib/server/types.ts`

Add this interface (alongside your existing Event type):

```typescript
export interface ToolRun {
  // Basic log fields
  id: number;
  timestamp: Date;
  hostname: string;
  companyCode: number;
  appName: string;
  level: string;

  // Session context
  sessionId: string;
  
  // Tool specifics
  toolName: string;
  userContext: string;
  status: 'success' | 'failure' | 'unknown';
  
  // Performance
  durationMs: number | null;
  
  // Version info
  mcpVersion: string | null;
  
  // Error analysis (for failures)
  errorClass: string | null;
  
  // Result data
  resultKind: 'json' | 'text' | 'html';
  resultText: string;
  
  // GraphQL metadata
  gqlCount: number;
  gqlMaxTimeMs: number | null;
}
```

---

### Step 2: Create Parsing Functions

**File**: `src/lib/server/parsers.ts`

Update this file with additional parsing utilities:

```typescript
// Add to existing parsers.ts

/**
 * Check if a parsed meta object represents a tool run
 */
export function isToolRun(metaObj: any): boolean {
  return metaObj?.tool?.name !== undefined;
}

/**
 * Extract tool status from meta
 */
export function extractToolStatus(metaObj: any): 'success' | 'failure' | 'unknown' {
  if (metaObj?.tool?.result?.isError === true) {
    return 'failure';
  }
  if (metaObj?.tool?.result !== undefined) {
    return 'success';
  }
  return 'unknown';
}

/**
 * Extract MCP version from GraphQL headers
 * Prefers User-Agent, falls back to apollographql-client-version
 */
export function extractMcpVersion(metaObj: any): string | null {
  const userAgent = metaObj?.gql?.[0]?.headers?.['User-Agent'];
  if (userAgent) {
    // Parse "presage-api-mcp-server/0.2.0" -> "0.2.0"
    const match = userAgent.match(/\/(\d+\.\d+\.\d+)/);
    if (match) return match[1];
  }
  
  const apolloVersion = metaObj?.gql?.[0]?.headers?.['apollographql-client-version'];
  if (apolloVersion) return apolloVersion;
  
  return null;
}

/**
 * Parse duration from meta.tool.time like "60230.12ms" -> 60230
 */
export function extractDurationMs(metaObj: any): number | null {
  const timeStr = metaObj?.tool?.time;
  if (!timeStr) return null;
  
  const match = timeStr.match(/^([\d.]+)ms$/);
  if (match) {
    return Math.round(parseFloat(match[1]));
  }
  
  return null;
}

/**
 * Classify error type for failed tool runs
 */
export function classifyError(resultText: string): string | null {
  if (!resultText) return null;
  
  const lower = resultText.toLowerCase();
  
  if (lower.includes('504') || lower.includes('gateway time-out')) {
    return 'gateway_timeout_504';
  }
  if (lower.includes('timeout')) {
    return 'timeout_other';
  }
  if (lower.includes('graphql request failed')) {
    return 'graphql_failed_other';
  }
  
  return 'other';
}

/**
 * Determine result kind (json, html, or text)
 */
export function determineResultKind(resultText: string): 'json' | 'text' | 'html' {
  if (!resultText) return 'text';
  
  // Try to parse as JSON
  try {
    JSON.parse(resultText);
    return 'json';
  } catch {
    // Not JSON
  }
  
  // Check for HTML
  if (/<html|<div|<span|<!doctype/i.test(resultText)) {
    return 'html';
  }
  
  return 'text';
}

/**
 * Extract GraphQL call metadata
 */
export function extractGqlMetadata(metaObj: any): {
  gqlCount: number;
  gqlMaxTimeMs: number | null;
} {
  const gqlArray = metaObj?.gql;
  if (!Array.isArray(gqlArray)) {
    return { gqlCount: 0, gqlMaxTimeMs: null };
  }
  
  const times = gqlArray
    .map((g: any) => g.time)
    .filter((t: any) => typeof t === 'number');
  
  return {
    gqlCount: gqlArray.length,
    gqlMaxTimeMs: times.length > 0 ? Math.max(...times) : null
  };
}

/**
 * Transform a raw DB row into a ToolRun object
 */
export function parseToolRun(row: any): ToolRun | null {
  const metaObj = tryParseJSON(row.meta);
  
  // Must have tool.name to be a valid tool run
  if (!isToolRun(metaObj)) {
    return null;
  }
  
  const sessionId = extractSessionId(row.message, metaObj);
  if (!sessionId) {
    return null; // Tool runs should always have a session
  }
  
  const status = extractToolStatus(metaObj);
  const resultText = metaObj?.tool?.result?.text || 
                     metaObj?.tool?.result?.error || 
                     '';
  
  const { gqlCount, gqlMaxTimeMs } = extractGqlMetadata(metaObj);
  
  return {
    id: row.id,
    timestamp: row.timestamp,
    hostname: row.hostname,
    companyCode: row.company_code,
    appName: row.app_name,
    level: row.level,
    sessionId,
    toolName: metaObj.tool.name,
    userContext: metaObj.tool.userContext || '',
    status,
    durationMs: extractDurationMs(metaObj),
    mcpVersion: extractMcpVersion(metaObj),
    errorClass: status === 'failure' ? classifyError(resultText) : null,
    resultKind: determineResultKind(resultText),
    resultText,
    gqlCount,
    gqlMaxTimeMs
  };
}
```

---

### Step 3: Create the API Route

**File**: `src/routes/api/tool-runs/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db';
import { parseToolRun } from '$lib/server/parsers';
import type { ToolRun } from '$lib/server/types';

export const GET: RequestHandler = async ({ url }) => {
  const pool = getPool();
  
  // Parse query parameters
  const hostname = url.searchParams.get('hostname') || '';
  const companyCode = url.searchParams.get('companyCode') || '';
  const appName = url.searchParams.get('appName') || '';
  const level = url.searchParams.get('level') || '';
  const q = url.searchParams.get('q') || ''; // Text search
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  // Additional filters to apply after parsing
  const toolName = url.searchParams.get('toolName') || '';
  const status = url.searchParams.get('status') || '';
  const version = url.searchParams.get('version') || '';
  const userContextSearch = url.searchParams.get('userContextSearch') || '';
  
  try {
    // Build SQL query with basic filters
    let sql = 'SELECT * FROM errsole_logs_v3 WHERE 1=1';
    const params: any[] = [];
    
    // Apply basic filters
    if (hostname) {
      sql += ' AND hostname = ?';
      params.push(hostname);
    }
    
    if (companyCode) {
      sql += ' AND company_code = ?';
      params.push(parseInt(companyCode));
    }
    
    if (appName) {
      sql += ' AND app_name = ?';
      params.push(appName);
    }
    
    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }
    
    // Text search on message using FULLTEXT
    if (q) {
      sql += ' AND MATCH(message) AGAINST (? IN BOOLEAN MODE)';
      params.push(q);
    }
    
    // Order by timestamp descending (most recent first)
    sql += ' ORDER BY timestamp DESC, id DESC';
    
    // Fetch more than needed since we'll filter for tool runs
    // Use a larger batch to ensure we get enough tool runs
    const fetchLimit = Math.min(limit * 10, 5000);
    sql += ' LIMIT ? OFFSET ?';
    params.push(fetchLimit, offset);
    
    // Execute query
    const [rows] = await pool.query(sql, params);
    
    // Parse rows and filter for tool runs
    let toolRuns: ToolRun[] = [];
    for (const row of rows as any[]) {
      const toolRun = parseToolRun(row);
      if (toolRun) {
        toolRuns.push(toolRun);
      }
    }
    
    // Apply additional filters (post-parse)
    if (toolName) {
      toolRuns = toolRuns.filter(tr => 
        tr.toolName.toLowerCase().includes(toolName.toLowerCase())
      );
    }
    
    if (status) {
      toolRuns = toolRuns.filter(tr => tr.status === status);
    }
    
    if (version) {
      toolRuns = toolRuns.filter(tr => 
        tr.mcpVersion?.includes(version)
      );
    }
    
    if (userContextSearch) {
      toolRuns = toolRuns.filter(tr =>
        tr.userContext.toLowerCase().includes(userContextSearch.toLowerCase())
      );
    }
    
    // Apply final pagination
    const paginatedRuns = toolRuns.slice(0, limit);
    
    return json({
      toolRuns: paginatedRuns,
      hasMore: toolRuns.length > limit,
      total: paginatedRuns.length
    });
    
  } catch (error) {
    console.error('Error fetching tool runs:', error);
    return json({ error: 'Failed to fetch tool runs' }, { status: 500 });
  }
};
```

---

### Step 4: Create the Frontend Page

**File**: `src/routes/tool-runs/+page.svelte`

```svelte
<script lang="ts">
  import type { ToolRun } from '$lib/server/types';
  
  // State for filters
  let hostname = $state('');
  let companyCode = $state('');
  let appName = $state('');
  let level = $state('');
  let textSearch = $state('');
  let toolNameFilter = $state('');
  let statusFilter = $state('');
  let versionFilter = $state('');
  let showFailuresOnly = $state(false);
  
  // State for results
  let toolRuns = $state<ToolRun[]>([]);
  let loading = $state(false);
  let error = $state('');
  let selectedRun = $state<ToolRun | null>(null);
  
  // Pagination
  let offset = $state(0);
  let limit = $state(50);
  let hasMore = $state(false);
  
  // Fetch tool runs
  async function fetchToolRuns() {
    loading = true;
    error = '';
    
    try {
      const params = new URLSearchParams();
      if (hostname) params.set('hostname', hostname);
      if (companyCode) params.set('companyCode', companyCode);
      if (appName) params.set('appName', appName);
      if (level) params.set('level', level);
      if (textSearch) params.set('q', textSearch);
      if (toolNameFilter) params.set('toolName', toolNameFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (versionFilter) params.set('version', versionFilter);
      if (showFailuresOnly) params.set('status', 'failure');
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());
      
      const response = await fetch(`/api/tool-runs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      toolRuns = data.toolRuns;
      hasMore = data.hasMore;
    } catch (err) {
      error = 'Failed to load tool runs';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  // Auto-fetch on mount
  $effect(() => {
    fetchToolRuns();
  });
  
  function handleSearch() {
    offset = 0; // Reset to first page
    fetchToolRuns();
  }
  
  function nextPage() {
    offset += limit;
    fetchToolRuns();
  }
  
  function prevPage() {
    offset = Math.max(0, offset - limit);
    fetchToolRuns();
  }
  
  function formatDuration(ms: number | null): string {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  function formatTimestamp(date: Date): string {
    return new Date(date).toLocaleString();
  }
  
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'success': return 'badge-success';
      case 'failure': return 'badge-failure';
      default: return 'badge-unknown';
    }
  }
</script>

<div class="page">
  <h1>Tool Runs Browser</h1>
  
  <!-- Filter Panel -->
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
        <input id="appName" type="text" bind:value={appName} placeholder="e.g., enterprise-mcp" />
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
        <input id="toolName" type="text" bind:value={toolNameFilter} placeholder="e.g., query_graphql" />
      </div>
      
      <div class="filter-group">
        <label for="version">MCP Version</label>
        <input id="version" type="text" bind:value={versionFilter} placeholder="e.g., 0.2.0" />
      </div>
      
      <div class="filter-group">
        <label for="textSearch">Text Search</label>
        <input id="textSearch" type="text" bind:value={textSearch} placeholder="Search in messages" />
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
            <tr onclick={() => selectedRun = run} class="clickable">
              <td>{formatTimestamp(run.timestamp)}</td>
              <td class="tool-name">{run.toolName}</td>
              <td>
                <span class="badge {getStatusBadgeClass(run.status)}">
                  {run.status}
                </span>
              </td>
              <td>{formatDuration(run.durationMs)}</td>
              <td>{run.mcpVersion || 'N/A'}</td>
              <td>{run.hostname}</td>
              <td class="user-preview">{run.userContext.substring(0, 50)}...</td>
            </tr>
          {/each}
        </tbody>
      </table>
      
      <div class="pagination">
        <button onclick={prevPage} disabled={offset === 0 || loading}>
          Previous
        </button>
        <span>Showing {offset + 1} - {offset + toolRuns.length}</span>
        <button onclick={nextPage} disabled={!hasMore || loading}>
          Next
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Detail Modal -->
{#if selectedRun}
  <div class="modal-overlay" onclick={() => selectedRun = null}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Tool Run Details</h2>
        <button class="close-btn" onclick={() => selectedRun = null}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="detail-section">
          <h3>Basic Info</h3>
          <dl>
            <dt>ID:</dt><dd>{selectedRun.id}</dd>
            <dt>Timestamp:</dt><dd>{formatTimestamp(selectedRun.timestamp)}</dd>
            <dt>Tool Name:</dt><dd>{selectedRun.toolName}</dd>
            <dt>Status:</dt>
            <dd>
              <span class="badge {getStatusBadgeClass(selectedRun.status)}">
                {selectedRun.status}
              </span>
            </dd>
            <dt>Duration:</dt><dd>{formatDuration(selectedRun.durationMs)}</dd>
            <dt>Version:</dt><dd>{selectedRun.mcpVersion || 'N/A'}</dd>
          </dl>
        </div>
        
        <div class="detail-section">
          <h3>Context</h3>
          <dl>
            <dt>Session ID:</dt><dd class="monospace">{selectedRun.sessionId}</dd>
            <dt>Hostname:</dt><dd>{selectedRun.hostname}</dd>
            <dt>Company Code:</dt><dd>{selectedRun.companyCode}</dd>
            <dt>App Name:</dt><dd>{selectedRun.appName}</dd>
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
              <dt>Error Class:</dt><dd>{selectedRun.errorClass}</dd>
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
            <dt>GQL Calls:</dt><dd>{selectedRun.gqlCount}</dd>
            <dt>Max GQL Time:</dt>
            <dd>{selectedRun.gqlMaxTimeMs ? `${selectedRun.gqlMaxTimeMs}ms` : 'N/A'}</dd>
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
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
    max-width: 300px;
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
</style>
```

---

### Step 5: Add Navigation Link

**File**: `src/routes/+layout.svelte`

Update your layout to include a link to the tool runs page:

```svelte
<!-- Add to your existing nav -->
<nav>
  <a href="/">Home</a>
  <a href="/sessions">Sessions</a>
  <a href="/tool-runs">Tool Runs</a>
</nav>
```

---

## 🧪 Testing Your Implementation

### Test Scenarios

1. **Basic browsing**:
   - Visit `/tool-runs`
   - Should see a list of recent tool executions

2. **Filter by hostname**:
   - Enter a hostname value
   - Click "Search"
   - Should only see runs from that customer

3. **Failures only**:
   - Check "Show Failures Only"
   - Click "Search"
   - Should only see failed tool runs with red badges

4. **Detail modal**:
   - Click any row in the table
   - Modal should open with full details
   - Should see user context, result, and metadata

5. **Text search**:
   - Enter a search term like "timeout"
   - Should find runs with that term in the message

6. **Pagination**:
   - Click "Next" at bottom
   - Should load next batch of results

### SQL to Test Directly

```sql
-- How many tool runs do you have?
SELECT COUNT(*) 
FROM errsole_logs_v3 
WHERE meta LIKE '%"tool":%';

-- Sample tool runs
SELECT id, timestamp, hostname, LEFT(message, 100) as msg_preview
FROM errsole_logs_v3 
WHERE meta LIKE '%"tool":%'
ORDER BY timestamp DESC 
LIMIT 10;

-- Check for failures
SELECT id, timestamp, hostname, message
FROM errsole_logs_v3 
WHERE meta LIKE '%"isError":true%'
LIMIT 10;
```

---

## 🎯 Success Criteria

You've completed Milestone 2 when:

- ✅ `/tool-runs` page loads with a filter panel
- ✅ Can filter by hostname, company code, app name, level
- ✅ Can search by text in messages
- ✅ Can filter by tool name, status, version
- ✅ "Show Failures Only" quick filter works
- ✅ Results table displays tool runs with status badges
- ✅ Clicking a row opens detail modal
- ✅ Modal shows full user context, result, and metadata
- ✅ Pagination works (Previous/Next buttons)
- ✅ No crashes when meta is invalid JSON

---

## 🐛 Common Issues & Fixes

### No results showing
- Check that you have tool runs in the database (run SQL test queries)
- Verify your filters aren't too restrictive
- Check browser console for errors

### Modal doesn't open
- Check that `selectedRun` is being set on row click
- Verify the `onclick` handler is working

### Filters not working
- Check that `handleSearch()` is called on button click
- Verify query parameters are being built correctly
- Check Network tab to see what's being sent to the API

### Parsing errors
- Check your `tryParseJSON` function catches all errors
- Verify that `isToolRun()` is checking for `meta.tool.name`
- Look at console logs for specific parsing failures

### Performance slow with many results
- Reduce `fetchLimit` in the API route
- Add more specific filters to narrow results
- Consider adding indexes to your database

---

## 💡 What You Learned

- **Multi-parameter filtering**: Building complex queries from URL params
- **Two-stage filtering**: MySQL filters first, then Node filters
- **FULLTEXT search**: Using MySQL's FULLTEXT index for text search
- **Modal patterns**: Click-to-view detail pattern in Svelte 5
- **Pagination**: Offset-based pagination with Previous/Next
- **Safe parsing**: Handling invalid JSON gracefully
- **Status classification**: Deriving status from nested meta objects

---

## 🚀 Next Steps

Ready for **Milestone 3: Prompt Summary**? You'll learn to:
- Group identical prompts across multiple tool runs
- Aggregate statistics (success rate, avg duration)
- Compare performance across MCP versions
- Build a different kind of view (grouped instead of flat list)

---

## 📝 Quick Reference

### Key Files Created/Modified
- ✅ `src/lib/server/types.ts` - Added ToolRun interface
- ✅ `src/lib/server/parsers.ts` - Added tool run parsing functions
- ✅ `src/routes/api/tool-runs/+server.ts` - API endpoint
- ✅ `src/routes/tool-runs/+page.svelte` - Frontend page
- ✅ `src/routes/+layout.svelte` - Navigation link

### Important Patterns
- Parse meta safely with `tryParseJSON()`
- Check `isToolRun()` before creating ToolRun objects
- Apply basic filters in SQL, advanced filters in Node
- Use FULLTEXT search for text queries
- Store selected item in `$state()` for modals

---

Need help? Review the Mental Model section or check your Milestone 1 code for comparison patterns!
