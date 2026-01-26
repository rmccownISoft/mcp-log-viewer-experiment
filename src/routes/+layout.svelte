<script>
	import { page } from '$app/state'
	
	let { children } = $props()
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