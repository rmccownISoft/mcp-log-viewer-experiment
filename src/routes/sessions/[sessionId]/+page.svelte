<script lang="ts">
    import type { PageData } from './$types'
    import { page } from '$app/state'

    let { data }: { data: PageData } = $props()

    // State for detail drawer?
    let selectedEvent: typeof data.events[0] | null = $state(null)
    let showToolOnly = $state(false)

    // Filtered events 
    let filteredEvents = $derived(showToolOnly 
        ? data.events.filter(e => e.toolName !== null)
        : data.events)

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
            case 'success': return '✓'
            case 'failure': return '✗'
            case 'unknown': return '?'
            default: return '○'
        }
    }    

    function closeDrawer() {
        selectedEvent = null
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