# Milestone 1: Session Explorer 🔍

**Goal**: Build a page where users can enter a session ID and see all the events (logs) that happened during that session, displayed in chronological order.

**Time Estimate**: 1-2 hours

---

## 🧠 Mental Model: The Session Timeline

Think of a session like a conversation between a user and an AI assistant. During that conversation, many things happen:
- The user asks questions
- Tools get called (database queries, API calls, etc.)
- Results come back (success or failure)
- The conversation continues

A session ID is like a unique conversation ID. By filtering logs by session ID, you can see the complete story of what happened.

```
Session "abc-123-def"
│
├─ [10:15:00] User starts conversation
├─ [10:15:05] Tool 'query_database' called
├─ [10:15:08] Tool succeeded → returned 42 rows
├─ [10:15:10] User asks follow-up question
├─ [10:15:12] Tool 'fetch_weather' called
└─ [10:15:15] Tool failed → timeout error

Timeline View:
┌────────────────────────────────────────┐
│ 10:15:00 - Conversation started        │
│ 10:15:05 - Tool: query_database        │
│            Status: ✓ Success           │
│            Result: 42 rows             │
│ 10:15:10 - Message received            │
│ 10:15:12 - Tool: fetch_weather         │
│            Status: ✗ Failed            │
│            Error: timeout              │
└────────────────────────────────────────┘
```

**Key Insight**: All these events share the same session ID in the database. By searching for that ID, you can reconstruct the entire timeline.

---

## 📋 What You'll Build

By the end of this milestone:
- ✅ `/sessions` page with a search box to enter session IDs
- ✅ `/sessions/[sessionId]` page showing the timeline for that session
- ✅ Event cards that display timestamp, message, tool name, and status
- ✅ Detail drawer that shows full JSON when you click an event
- ✅ Toggle to show only tool-related events
- ✅ API endpoint that queries and parses the data

---

## 🛠️ Step-by-Step Guide

### Step 1: Create the Parsing Utilities

Before querying the database, let's create helper functions to safely parse the JSON in the `meta` column.

**Action**: Create the file `src/lib/server/parsers.ts`:

```typescript
import type { LogRow, LogMeta, Event } from './types';

/**
 * Safely parse JSON from the meta column
 * Returns empty object if parsing fails
 */
export function parseMetaSafely(metaText: string): LogMeta {
  try {
    return JSON.parse(metaText);
  } catch (error) {
    console.warn('Failed to parse meta JSON:', error);
    return {};
  }
}

/**
 * Extract session ID from meta or message
 * Prefers meta.sessionId, falls back to regex on message
 */
export function extractSessionId(row: LogRow, metaObj: LogMeta): string | null {
  // First try: meta.sessionId
  if (metaObj.sessionId) {
    return metaObj.sessionId;
  }
  
  // Second try: parse from message like "session 'abc-123-def'"
  const match = row.message.match(/session\s+'([^']+)'/i);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Extract tool name from meta
 */
export function extractToolName(metaObj: LogMeta): string | null {
  return metaObj.tool?.name || null;
}

/**
 * Extract user name from message
 * Looks for patterns like "called by user 'John Doe'"
 */
export function extractUserName(message: string): string | null {
  const match = message.match(/user\s+'([^']+)'/i);
  return match ? match[1] : null;
}

/**
 * Extract user context (the prompt/question) from meta
 */
export function extractUserContext(metaObj: LogMeta): string | null {
  // This might be in different places depending on your logs
  // Adjust based on your actual data structure
  return metaObj.userContext || metaObj.prompt || null;
}

/**
 * Determine tool execution status
 */
export function getToolStatus(metaObj: LogMeta): 'success' | 'failure' | 'unknown' | 'none' {
  // If no tool in meta, this isn't a tool execution
  if (!metaObj.tool) {
    return 'none';
  }
  
  // Check if result indicates error
  if (metaObj.tool.result?.isError === true) {
    return 'failure';
  }
  
  // If we have a result and it's not an error, it's success
  if (metaObj.tool.result) {
    return 'success';
  }
  
  // Tool exists but status unclear
  return 'unknown';
}

/**
 * Get a preview of the result (first 100 chars)
 */
export function getResultPreview(metaObj: LogMeta): string | null {
  const result = metaObj.tool?.result;
  if (!result) return null;
  
  try {
    const resultStr = typeof result === 'string' 
      ? result 
      : JSON.stringify(result);
    
    return resultStr.length > 100 
      ? resultStr.substring(0, 100) + '...'
      : resultStr;
  } catch {
    return null;
  }
}

/**
 * Convert a database row to a normalized Event
 */
export function rowToEvent(row: LogRow): Event {
  const metaObj = parseMetaSafely(row.meta);
  
  return {
    id: row.id,
    timestamp: row.timestamp,
    hostname: row.hostname,
    companyCode: row.company_code,
    appName: row.app_name,
    level: row.level,
    message: row.message,
    sessionId: extractSessionId(row, metaObj),
    toolName: extractToolName(metaObj),
    userName: extractUserName(row.message),
    userContext: extractUserContext(metaObj),
    toolStatus: getToolStatus(metaObj),
    resultPreview: getResultPreview(metaObj)
  };
}
```

**Understanding the code**:
- Each function handles one parsing task (single responsibility)
- We use try/catch to handle bad JSON gracefully
- `rowToEvent()` is the main function that transforms database rows
- All field extraction is centralized here (easy to modify later)

**Why separate parsers?**: These functions will be reused across all API endpoints. Write once, use everywhere!

---

### Step 2: Create the Session API Endpoint

Now let's build the backend that queries the database and returns parsed events.

**Action**: Create the file `src/routes/api/sessions/[sessionId]/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db';
import { rowToEvent } from '$lib/server/parsers';
import type { LogRow } from '$lib/server/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const { sessionId } = params;
  
  // Get query parameters
  const toolOnly = url.searchParams.get('toolOnly') === 'true';
  
  try {
    // Query logs that mention this session ID
    // We use LIKE on message since meta is just TEXT
    const query = `
      SELECT 
        id, timestamp, hostname, company_code, app_name, 
        level, message, meta
      FROM errsole_logs_v3
      WHERE message LIKE ?
      ORDER BY timestamp ASC, id ASC
      LIMIT 1000
    `;
    
    // The LIKE pattern searches for the session ID anywhere in the message
    const searchPattern = `%${sessionId}%`;
    
    const [rows] = await pool.query<LogRow[]>(query, [searchPattern]);
    
    // Parse all rows into Events
    let events = (rows as LogRow[]).map(rowToEvent);
    
    // Filter to only events that actually have this session ID
    // (our LIKE search might catch false positives)
    events = events.filter(event => event.sessionId === sessionId);
    
    // If toolOnly filter is on, keep only tool-related events
    if (toolOnly) {
      events = events.filter(event => event.toolName !== null);
    }
    
    return json({
      sessionId,
      events,
      count: events.length,
      toolOnly
    });
    
  } catch (error) {
    console.error('Error fetching session:', error);
    
    return json({
      error: 'Failed to fetch session data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
```

**Understanding the code**:
- `[sessionId]` in the folder name becomes `params.sessionId` 
- We search using `LIKE` because session ID might be anywhere in the message
- `LIMIT 1000` prevents accidentally loading millions of rows
- We filter after parsing to avoid false positives from the LIKE search
- The `toolOnly` parameter comes from the URL like `?toolOnly=true`

**SQL Note**: `message LIKE '%abc-123%'` finds any message containing "abc-123". The `%` is a wildcard meaning "anything".

**Why ORDER BY timestamp ASC?**: We want to show events in the order they happened (oldest first).

---

### Step 3: Create the Session Search Page

This is your landing page where users enter a session ID.

**Action**: Create the file `src/routes/sessions/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  
  let sessionId = $state('');
  
  function handleSearch() {
    if (sessionId.trim()) {
      goto(`/sessions/${encodeURIComponent(sessionId.trim())}`);
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
</script>

<main>
  <h1>Session Explorer</h1>
  
  <div class="search-box">
    <label for="session-id">
      Enter Session ID
      <span class="hint">Example: abc-123-def-456</span>
    </label>
    
    <div class="input-group">
      <input
        id="session-id"
        type="text"
        bind:value={sessionId}
        onkeydown={handleKeydown}
        placeholder="Paste session ID here..."
        class="session-input"
      />
      <button 
        onclick={handleSearch}
        disabled={!sessionId.trim()}
        class="search-button"
      >
        View Timeline
      </button>
    </div>
  </div>
  
  <div class="tips">
    <h2>💡 Tips</h2>
    <ul>
      <li>Session IDs are usually UUIDs (e.g., <code>550e8400-e29b-41d4-a716-446655440000</code>)</li>
      <li>You can find session IDs in log messages or error reports</li>
      <li>The timeline shows all events in chronological order</li>
      <li>Click any event to see the full details</li>
    </ul>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
  }
  
  h1 {
    color: #333;
    margin-bottom: 2rem;
  }
  
  .search-box {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
  }
  
  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #333;
  }
  
  .hint {
    display: block;
    font-weight: normal;
    font-size: 0.9rem;
    color: #666;
    margin-top: 0.25rem;
  }
  
  .input-group {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .session-input {
    flex: 1;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    font-family: 'Courier New', monospace;
  }
  
  .session-input:focus {
    outline: none;
    border-color: #2196F3;
  }
  
  .search-button {
    padding: 0.75rem 1.5rem;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .search-button:hover:not(:disabled) {
    background: #1976D2;
  }
  
  .search-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .tips {
    background: #f5f5f5;
    padding: 1.5rem;
    border-radius: 8px;
  }
  
  .tips h2 {
    margin-top: 0;
    font-size: 1.2rem;
  }
  
  .tips ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .tips li {
    margin: 0.5rem 0;
    color: #555;
  }
  
  .tips code {
    background: white;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.9rem;
  }
</style>
```

**Understanding the code**:
- `$state('')` creates a reactive state variable that triggers UI updates when changed
- `bind:value={sessionId}` creates two-way binding (input updates variable, variable updates input)
- `goto()` is SvelteKit's navigation function (like React Router's navigate)
- `encodeURIComponent()` handles special characters in URLs safely
- `onkeydown` is the modern Svelte 5 event handler syntax (no colon)
- Button is disabled when input is empty (`disabled={!sessionId.trim()}`)

**Accessibility tip**: We use a proper `<label>` with `for="session-id"` so clicking the label focuses the input.

---

### Step 4: Create the Session Detail Page

This is the main timeline view showing all events for a session.

**Action**: Create the file `src/routes/sessions/[sessionId]/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  // State for the detail drawer
  let selectedEvent: typeof data.events[0] | null = $state(null);
  let showToolOnly = $state(false);
  
  // Reactive filtered events
  let filteredEvents = $derived(showToolOnly 
    ? data.events.filter(e => e.toolName !== null)
    : data.events);
  
  function formatTime(timestamp: Date | string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }
  
  function formatDate(timestamp: Date | string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return '✓';
      case 'failure': return '✗';
      case 'unknown': return '?';
      default: return '○';
    }
  }
  
  function closeDrawer() {
    selectedEvent = null;
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
        <span class="label">Events:</span>
        <span class="value">{filteredEvents.length}</span>
      </div>
      
      {#if data.events.length > 0}
        <div class="info-item">
          <span class="label">Date:</span>
          <span class="value">{formatDate(data.events[0].timestamp)}</span>
        </div>
      {/if}
      
      <label class="toggle">
        <input type="checkbox" bind:checked={showToolOnly} />
        <span>Tools only</span>
      </label>
    </div>
  </header>
  
  {#if data.events.length === 0}
    <div class="empty-state">
      <p>No events found for this session.</p>
      <p class="hint">
        Make sure the session ID is correct, or try a different session.
      </p>
    </div>
  {:else}
    <div class="timeline">
      {#each filteredEvents as event (event.id)}
        <button
          class="event-card"
          class:has-tool={event.toolName !== null}
          class:success={event.toolStatus === 'success'}
          class:failure={event.toolStatus === 'failure'}
          onclick={() => selectedEvent = event}
        >
          <div class="event-header">
            <span class="timestamp">{formatTime(event.timestamp)}</span>
            {#if event.toolName}
              <span class="status-badge" class:success={event.toolStatus === 'success'} class:failure={event.toolStatus === 'failure'}>
                {getStatusIcon(event.toolStatus)}
                {event.toolStatus}
              </span>
            {/if}
          </div>
          
          <div class="event-body">
            {#if event.toolName}
              <div class="tool-name">
                🔧 {event.toolName}
              </div>
            {/if}
            
            <div class="message">{event.message}</div>
            
            {#if event.userName}
              <div class="metadata">
                User: <span class="user">{event.userName}</span>
              </div>
            {/if}
            
            {#if event.resultPreview}
              <div class="result-preview">
                {event.resultPreview}
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</main>

<!-- Detail Drawer -->
{#if selectedEvent}
  <div class="drawer-overlay" onclick={closeDrawer}></div>
  
  <div class="drawer">
    <div class="drawer-header">
      <h2>Event Details</h2>
      <button class="close-btn" onclick={closeDrawer}>×</button>
    </div>
    
    <div class="drawer-content">
      <div class="detail-section">
        <h3>Basic Info</h3>
        <dl>
          <dt>ID</dt>
          <dd>{selectedEvent.id}</dd>
          
          <dt>Timestamp</dt>
          <dd>{new Date(selectedEvent.timestamp).toLocaleString()}</dd>
          
          <dt>Hostname</dt>
          <dd>{selectedEvent.hostname}</dd>
          
          <dt>App</dt>
          <dd>{selectedEvent.appName}</dd>
          
          <dt>Level</dt>
          <dd class="level-badge level-{selectedEvent.level.toLowerCase()}">{selectedEvent.level}</dd>
        </dl>
      </div>
      
      {#if selectedEvent.toolName}
        <div class="detail-section">
          <h3>Tool Execution</h3>
          <dl>
            <dt>Tool Name</dt>
            <dd>{selectedEvent.toolName}</dd>
            
            <dt>Status</dt>
            <dd class:success={selectedEvent.toolStatus === 'success'} class:failure={selectedEvent.toolStatus === 'failure'}>
              {getStatusIcon(selectedEvent.toolStatus)} {selectedEvent.toolStatus}
            </dd>
            
            {#if selectedEvent.userName}
              <dt>User</dt>
              <dd>{selectedEvent.userName}</dd>
            {/if}
          </dl>
        </div>
      {/if}
      
      <div class="detail-section">
        <h3>Message</h3>
        <pre class="message-text">{selectedEvent.message}</pre>
      </div>
      
      {#if selectedEvent.userContext}
        <div class="detail-section">
          <h3>User Context</h3>
          <pre class="context-text">{selectedEvent.userContext}</pre>
        </div>
      {/if}
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
    color: #2196F3;
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
  
  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    margin-left: auto;
  }
  
  .toggle input {
    cursor: pointer;
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
    border-color: #2196F3;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
  }
  
  .event-card.has-tool {
    border-left: 4px solid #2196F3;
  }
  
  .event-card.success {
    border-left-color: #4CAF50;
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
    background: #E8F5E9;
    color: #2E7D32;
  }
  
  .status-badge.failure {
    background: #FFEBEE;
    color: #C62828;
  }
  
  .event-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .tool-name {
    font-weight: 600;
    color: #2196F3;
  }
  
  .message {
    color: #333;
    line-height: 1.5;
  }
  
  .metadata {
    font-size: 0.9rem;
    color: #666;
  }
  
  .metadata .user {
    color: #2196F3;
    font-weight: 500;
  }
  
  .result-preview {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Drawer */
  .drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }
  
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 500px;
    max-width: 90vw;
    background: white;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
    z-index: 101;
    display: flex;
    flex-direction: column;
  }
  
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }
  
  .drawer-header h2 {
    margin: 0;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }
  
  .close-btn:hover {
    color: #333;
  }
  
  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }
  
  .detail-section {
    margin-bottom: 2rem;
  }
  
  .detail-section h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }
  
  .detail-section dl {
    margin: 0;
  }
  
  .detail-section dt {
    font-weight: 600;
    color: #666;
    margin-top: 0.75rem;
  }
  
  .detail-section dd {
    margin: 0.25rem 0 0 0;
    color: #333;
  }
  
  .detail-section dd.success {
    color: #4CAF50;
    font-weight: 600;
  }
  
  .detail-section dd.failure {
    color: #f44336;
    font-weight: 600;
  }
  
  .level-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .level-badge.level-error {
    background: #FFEBEE;
    color: #C62828;
  }
  
  .level-badge.level-warn {
    background: #FFF3E0;
    color: #E65100;
  }
  
  .level-badge.level-info {
    background: #E3F2FD;
    color: #1565C0;
  }
  
  .message-text,
  .context-text {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
```

**Understanding the code**:
- `let { data } = $props()` receives data from the server loader using the modern props syntax
- `$state()` creates reactive state that triggers UI updates when changed
- `$derived()` creates a derived value that automatically updates when dependencies change
- The drawer uses fixed positioning to slide in from the right
- `{#each}` loops over events, `(event.id)` is the unique key
- Class binding like `class:success={condition}` applies the class when true

---

### Step 5: Create the Server Data Loader

This file loads data on the server before the page renders.

**Action**: Create the file `src/routes/sessions/[sessionId]/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import type { Event } from '$lib/server/types';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const { sessionId } = params;
  
  try {
    // Call our API endpoint
    const response = await fetch(`/api/sessions/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch session: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      sessionId,
      events: data.events as Event[],
      count: data.count
    };
    
  } catch (error) {
    console.error('Error loading session:', error);
    
    // Return empty data on error
    return {
      sessionId,
      events: [] as Event[],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
```

**Understanding the code**:
- `PageServerLoad` runs on the server before the page loads
- It calls the API we built in Step 2
- The returned data becomes `data` in the `+page.svelte` component
- If there's an error, we return empty events instead of crashing

**Why use a server loader?**: It pre-fetches data on the server, so the page loads with data already there (better UX, better SEO).

---

### Step 6: Update the Navigation

Let's add a link to the Session Explorer in your main navigation.

**Action**: Edit `src/routes/+layout.svelte` (create it if it doesn't exist):

```svelte
<script lang="ts">
  import { page } from '$app/state';
  
  let { children } = $props();
</script>

<div class="layout">
  <nav>
    <div class="nav-brand">
      <a href="/">MCP Log Explorer</a>
    </div>
    <div class="nav-links">
      <a href="/sessions" class:active={page.url.pathname.startsWith('/sessions')}>
        Sessions
      </a>
      <a href="/tool-runs" class:active={page.url.pathname.startsWith('/tool-runs')}>
        Tool Runs
      </a>
      <a href="/prompts" class:active={page.url.pathname.startsWith('/prompts')}>
        Prompts
      </a>
    </div>
  </nav>
  
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  nav {
    background: #2196F3;
    color: white;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .nav-brand a {
    color: white;
    text-decoration: none;
    font-size: 1.25rem;
    font-weight: 700;
  }
  
  .nav-links {
    display: flex;
    gap: 2rem;
  }
  
  .nav-links a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    font-weight: 500;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .nav-links a:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .nav-links a.active {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
  
  .content {
    flex: 1;
    background: #fafafa;
  }
  
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }
</style>
```

**Understanding the code**:
- `page` from `$app/state` is the Svelte 5 reactive state for accessing page data (replaces the deprecated `$app/stores`)
- `let { children } = $props()` receives the child page content as a snippet
- `{@render children()}` renders the child pages (replaces `<slot />` in Svelte 5)
- `:global(body)` applies styles globally (not scoped to this component)
- `class:active={condition}` adds the "active" class when true
- `page.url.pathname` gives the current URL path (no $ prefix needed with the new reactive state)

---

### Step 7: Test Your Work!

**Action**: Start your dev server and test:

```bash
pnpm dev
```

**Testing checklist**:

1. **Navigate to Sessions page**
   - Visit http://localhost:5173/sessions
   - You should see the search box
   
2. **Enter a test session ID**
   - If you know a real session ID from your database, enter it
   - Or try querying your database first:
   ```sql
   SELECT DISTINCT 
     JSON_EXTRACT(meta, '$.sessionId') as sessionId 
   FROM errsole_logs_v3 
   WHERE meta LIKE '%sessionId%' 
   LIMIT 10;
   ```
   - Copy one of the session IDs (without quotes)
   
3. **View the timeline**
   - Events should appear in chronological order
   - Tool events should have colored borders
   - Click any event to open the detail drawer
   
4. **Test the filters**
   - Toggle "Tools only" checkbox
   - Timeline should update to show only tool executions
   
5. **Test the API directly**
   - Visit http://localhost:5173/api/sessions/YOUR-SESSION-ID
   - You should see JSON with events array

---

## ✅ Success Criteria

You've completed Milestone 1 when:
- [ ] `/sessions` page loads with search box
- [ ] Entering a session ID navigates to `/sessions/[sessionId]`
- [ ] Timeline shows events in chronological order
- [ ] Clicking an event opens the detail drawer
- [ ] "Tools only" toggle filters the timeline
- [ ] API endpoint returns parsed events as JSON
- [ ] No errors in browser console or terminal

---

## 🐛 Troubleshooting

### "No events found for this session"

**Possible causes**:
1. Session ID doesn't exist in database
2. Session ID format is different than expected

**Solutions**:
- Query your database to find real session IDs:
  ```sql
  SELECT message, meta 
  FROM errsole_logs_v3 
  WHERE message LIKE '%session%' 
  LIMIT 10;
  ```
- Check if the session ID appears in `message` or only in `meta`
- Adjust the search pattern in the API if needed

### Events appear but have null values

**Possible causes**:
- `meta` field has different JSON structure than expected
- JSON parsing is failing

**Solutions**:
- Look at the raw `meta` JSON in your database
- Adjust the parser functions in `parsers.ts` to match your actual structure
- Add console.log in parsers to see what's being extracted

### Drawer doesn't open

**Solutions**:
- Check browser console for errors
- Make sure you're clicking the entire card (it's a button)
- Verify `selectedEvent` is being set in the click handler

### TypeScript errors about missing types

**Solutions**:
- Run `pnpm run check` to see all type errors
- Make sure `PageData` type is imported correctly
- Restart your TypeScript server in VS Code (Cmd/Ctrl+Shift+P → "Restart TS Server")

---

## 🎓 Key Concepts You Just Learned

1. **Dynamic Routes**: `[sessionId]` in folder names creates URL parameters
2. **Server Load Functions**: `+page.server.ts` pre-fetches data on the server
3. **API Endpoints**: `+server.ts` files create backend endpoints
4. **JSON Parsing**: Safely handling JSON stored as TEXT in MySQL
5. **Reactive State with Runes**: Using `$state` for reactive variables and `$derived` for computed values
6. **Component State**: Managing drawers and toggles with reactive state
7. **CSS Class Binding**: Dynamic styling with `class:name={condition}`

---

## 📝 What You Built

You now have:
- ✅ A search interface for finding sessions
- ✅ A timeline view showing all session events
- ✅ Detail drawer for inspecting individual events
- ✅ Filtering to show only tool executions
- ✅ API endpoint that parses and returns normalized events
- ✅ Reusable parser functions for other features

This is the foundation for all future analysis features!

---

## 🚀 Next Steps

Ready to browse tool runs across all sessions?

👉 **Continue to Milestone 2** (`milestone-2-tool-runs-browser.md`) to build a filterable browser for all tool executions!

---

## 💬 Self-Check Questions

Before moving on, make sure you understand:
- ✓ How does the session ID search work (LIKE vs exact match)?
- ✓ Why do we parse JSON in Node instead of MySQL?
- ✓ What's the difference between `+page.svelte` and `+page.server.ts`?
- ✓ How does the `toolOnly` filter work (client-side vs server-side)?
- ✓ Why do we use a drawer for details instead of inline expansion?

Understanding these will make Milestone 2 much easier!
