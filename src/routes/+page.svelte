<script lang="ts">
    import { onMount } from 'svelte'
    

    let healthStatus = $state({ status: 'checking', database: 'unknown' })

    onMount(async () => {
        try {
            const response = await fetch('api/health')
            healthStatus = await response.json()
        } catch (error) {
            healthStatus = { status: 'error', database: 'disconnected' }
        }
    })
</script>

<main>
    <h1>MCP Log Explorer</h1>

    <section class="health-check">
        <h2>System Status</h2>
        <p>Database: <strong class:ok={healthStatus.database === 'connected'}>
            {healthStatus.database}
        </strong></p>
    </section>

    <section class="navigation">
        <h2>Available Tools</h2>
        <ul>
            <li>
                <a href="/sessions">Session Explorer</a>
                <span class="badge coming-soon">Milestone 1</span>
            </li>
            <li>
                <a href="/tool-runs">Tool Runs Browser</a>
                <span class="badge coming-soon">Milestone 2</span>
            </li>
            <li>
                <a href="/prompts">Prompt Summary</a>
                <span class="badge coming-soon">Milestone 3</span>
            </li>
        </ul>
    </section>
</main>

<style>
  main {
    max-width: 800px;
    margin: 2rem auto;
    padding: 0 1rem;
  }
  
  h1 {
    color: #333;
    border-bottom: 3px solid #4CAF50;
    padding-bottom: 0.5rem;
  }
  
  .health-check {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .health-check strong {
    color: #f44336;
  }
  
  .health-check strong.ok {
    color: #4CAF50;
  }
  
  .navigation ul {
    list-style: none;
    padding: 0;
  }
  
  .navigation li {
    margin: 1rem 0;
    padding: 1rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .navigation a {
    color: #2196F3;
    text-decoration: none;
    font-weight: 500;
    font-size: 1.1rem;
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #FFC107;
    color: #333;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-left: 0.5rem;
  }
</style>