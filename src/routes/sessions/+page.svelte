<script lang="ts">
    import { goto } from '$app/navigation'
    
    let sessionId = $state('')
    
    function handleSearch() {
        if (sessionId.trim()) {
            goto(`/sessions/${encodeURIComponent(sessionId.trim())}`)
        }
    }
    
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
          handleSearch()
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