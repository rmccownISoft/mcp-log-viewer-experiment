# Milestone 0: Foundation 🏗️

**Goal**: Set up a SvelteKit app that can connect to your MySQL database and prove it works with a health check endpoint.

**Time Estimate**: 30-60 minutes

---

## 🧠 Mental Model: The Foundation

Think of this milestone as building the foundation of a house. Before you can add rooms (features), you need:
1. **Structure**: A working SvelteKit app
2. **Connection**: Ability to talk to your database
3. **Verification**: A way to test that everything works

```
┌─────────────────────────────────────┐
│     Your Computer / Server          │
│                                     │
│  ┌──────────────────┐               │
│  │  SvelteKit App   │               │
│  │  (Node.js)       │               │
│  │                  │               │
│  │  ┌────────────┐  │               │
│  │  │ DB Pool    │  │──────┐        │
│  │  │ (mysql2)   │  │      │        │
│  │  └────────────┘  │      │        │
│  │                  │      │        │
│  │  ┌────────────┐  │      │        │
│  │  │ /api/health│◄─┘      │        │
│  │  │ endpoint   │         │        │
│  │  └────────────┘         │        │
│  └─────────────────────────┼────────┘
│                            │
└────────────────────────────┼─────────
                             │
                    ┌────────▼────────┐
                    │ MySQL Database  │
                    │ errsole_logs_v3 │
                    └─────────────────┘
```

**Key Insight**: The connection pool is like having a set of phone lines to the database. Instead of opening a new connection every time, you keep a pool of connections ready to use. This is faster and more efficient.

---

## 📋 What You'll Build

By the end of this milestone:
- ✅ SvelteKit app configured with TypeScript and adapter-node
- ✅ MySQL connection pool that reads credentials from environment variables
- ✅ `/api/health` endpoint that returns database status
- ✅ Ability to test the endpoint in your browser

---

## 🛠️ Step-by-Step Guide

### Step 1: Install Database Package

You already have SvelteKit set up (I can see your `package.json`), so let's add the MySQL driver.

**Action**: Run this command in your terminal:
```bash
pnpm add mysql2
```

**What this does**: Installs `mysql2`, a fast MySQL client for Node.js. It will be used to connect to your database.

---

### Step 2: Create Environment Variables File

Environment variables are how you keep secrets (like database passwords) out of your code.

**Action**: Create a file called `.env` in the root of your project (same level as `package.json`):

```env
# Database connection
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
```

**Replace these values** with your actual MySQL credentials!

**Important**: Make sure `.env` is in your `.gitignore` file (it should be already). Never commit passwords to Git!

**How it works**: SvelteKit automatically loads `.env` files. In your server-side code, you'll access these using SvelteKit's built-in `$env` modules, which provide type safety and better error handling than direct `process.env` access.

---

### Step 3: Configure TypeScript for Environment Variables

Let's add type safety for our environment variables so TypeScript knows about them.

**Action**: Create or update `src/app.d.ts`:

```typescript
// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Type declarations for environment variables
declare module '$env/dynamic/private' {
	export const env: {
		DB_HOST: string;
		DB_PORT: string;
		DB_USER: string;
		DB_PASSWORD: string;
		DB_NAME: string;
		[key: string]: string | undefined;
	};
}

export {};
```

**Understanding the code**:
- The `App` namespace is used for SvelteKit-specific types (we'll use this in later milestones)
- The `$env/dynamic/private` module declaration tells TypeScript about our environment variables
- These variables are runtime values that can change per deployment without rebuilding

**Why this matters**: TypeScript will now autocomplete your environment variables and catch typos at compile time!

---

### Step 4: Create Database Connection Module

Now let's create a reusable database connection that your API routes can use.

**Action**: Create the file `src/lib/server/db.ts`:

```typescript
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

// Create a connection pool
// A pool maintains multiple connections to the database
// and reuses them, which is much faster than creating new connections
const pool = mysql.createPool({
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT || '3306'),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Maximum 10 concurrent connections
  queueLimit: 0
});

// Export a function to get a connection from the pool
export async function getConnection() {
  return await pool.getConnection();
}

// Export the pool itself for direct queries
export { pool };
```

**Understanding the code**:
- `mysql2/promise` gives us async/await support (cleaner than callbacks)
- `$env/dynamic/private` is SvelteKit's way to access private environment variables at runtime
- `createPool()` creates a pool of reusable connections
- `connectionLimit: 10` means we can have up to 10 active queries at once
- We export both `getConnection()` (for complex operations) and `pool` (for simple queries)

**Why `src/lib/server/`?**: The `server` folder is special in SvelteKit - code here only runs on the server, never in the browser. This keeps your database credentials safe! SvelteKit will error if you try to import these files from client code.

**Why `$env/dynamic/private`?**: This is SvelteKit's recommended way to access environment variables. It provides:
- Type safety (thanks to the declarations we added in Step 3)
- Runtime flexibility (values can change per deployment without rebuilding)
- Clear separation between public and private variables
- Better error messages when variables are missing

---

### Step 5: Create TypeScript Types

Let's define the shape of data we'll work with. This helps catch bugs early.

**Action**: Create the file `src/lib/server/types.ts`:

```typescript
// Raw row from the database
export interface LogRow {
  id: number;
  timestamp: Date;
  hostname: string;
  company_code: number;
  app_name: string;
  level: string;
  message: string;
  meta: string; // JSON stored as text
}

// Parsed meta field structure (what we expect in the JSON)
export interface LogMeta {
  sessionId?: string;
  tool?: {
    name?: string;
    time?: string; // e.g., "60230.12ms"
    result?: {
      isError?: boolean;
      [key: string]: any;
    };
  };
  gql?: Array<{
    headers?: {
      'User-Agent'?: string;
      'apollographql-client-version'?: string;
    };
  }>;
  [key: string]: any; // Allow other unknown fields
}

// Normalized event for the frontend
export interface Event {
  id: number;
  timestamp: Date;
  hostname: string;
  companyCode: number;
  appName: string;
  level: string;
  message: string;
  sessionId: string | null;
  toolName: string | null;
  userName: string | null;
  userContext: string | null;
  toolStatus: 'success' | 'failure' | 'unknown' | 'none';
  resultPreview: string | null;
}

// Normalized tool run for analysis
export interface ToolRun {
  id: number;
  timestamp: Date;
  hostname: string;
  companyCode: number;
  appName: string;
  level: string;
  sessionId: string;
  toolName: string;
  userContext: string | null;
  status: 'success' | 'failure' | 'unknown';
  durationMs: number | null;
  mcpVersion: string | null;
  errorClass: string | null;
  resultKind: 'json' | 'text' | 'html';
  resultText: string;
  gqlCount: number;
}
```

**Understanding the types**:
- `LogRow`: What comes directly from MySQL (snake_case, meta is string)
- `LogMeta`: What the JSON in `meta` looks like when parsed
- `Event`: Cleaned-up version for the frontend (camelCase, parsed fields)
- `ToolRun`: Specific to tool executions, with extra analysis fields

**Why types matter**: TypeScript will yell at you if you try to access `event.toolname` (lowercase) when it's actually `event.toolName`. This catches typos before they become bugs!

---

### Step 6: Create the Health Check API Endpoint

Now let's create your first API endpoint to test the database connection.

**Action**: Create the file `src/routes/api/health/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db';
import type { RequestHandler } from './$types';

// This handles GET requests to /api/health
export const GET: RequestHandler = async () => {
  try {
    // Try to execute a simple query
    const [rows] = await pool.query('SELECT 1 as test');
    
    // If we got here, the database is connected!
    return json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // If something went wrong, return an error
    console.error('Health check failed:', error);
    
    return json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};
```

**Understanding the code**:
- `+server.ts` files define API endpoints (backend routes)
- `export const GET` means "handle GET requests to this URL"
- `json()` is SvelteKit's helper to return JSON responses
- `pool.query()` executes SQL and returns results
- `SELECT 1` is a simple query that just tests the connection
- Try/catch handles errors gracefully

**The `$lib` alias**: In SvelteKit, `$lib` is a shortcut for `src/lib`. So `$lib/server/db` means `src/lib/server/db.ts`.

---

### Step 7: Update Your Home Page (Optional but Nice)

Let's update the home page to provide navigation links. We'll use Svelte 5's modern `$state` rune for reactive state management.

**Action**: Edit `src/routes/+page.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  
  // Using Svelte 5's $state rune for reactive state
  let healthStatus = $state({ status: 'checking', database: 'unknown' });
  
  onMount(async () => {
    try {
      const response = await fetch('/api/health');
      healthStatus = await response.json();
    } catch (error) {
      healthStatus = { status: 'error', database: 'disconnected' };
    }
  });
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
```

**Understanding the code**:
- `$state()` is a Svelte 5 rune that creates reactive state (replaces the old `let` pattern)
- `onMount()` runs when the component first appears (like React's useEffect)
- We `fetch('/api/health')` to test our endpoint
- The `:ok` class modifier applies the `.ok` style only when the condition is true
- Links are prepared for future milestones (they'll 404 for now, which is fine)

**About Svelte 5 Runes**: Svelte 5 introduces "runes" - special syntax for reactivity:
- `$state()` - creates reactive state (what we're using here)
- `$derived()` - creates computed values
- `$effect()` - runs side effects when dependencies change

You'll learn more about these powerful features as you progress through the milestones. For now, just know that `$state()` makes your variables automatically reactive - when you assign a new value, the UI updates!

---

### Step 8: Test Your Work!

**Action**: Start your development server:
```bash
pnpm dev
```

You should see output like:
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Now test**:

1. **Visit the home page**: http://localhost:5173/
   - You should see "MCP Log Explorer" 
   - Database status should show "connected" (in green)

2. **Visit the API directly**: http://localhost:5173/api/health
   - You should see JSON like:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "timestamp": "2026-01-24T05:36:00.000Z"
   }
   ```

3. **Check the terminal**: Look for any error messages

---

## ✅ Success Criteria

You've completed Milestone 0 when:
- [ ] `/api/health` returns `{"status": "ok", "database": "connected"}`
- [ ] No errors in the terminal
- [ ] Home page loads and shows green "connected" status

---

## 🐛 Troubleshooting

### "Cannot find module 'mysql2'"
- **Solution**: Run `pnpm install` to make sure packages are installed

### "Access denied for user"
- **Solution**: Check your `.env` file - username/password might be wrong
- Try connecting to MySQL using the same credentials with a MySQL client

### "connect ECONNREFUSED"
- **Solution**: MySQL server isn't running or wrong host/port
- Check if MySQL is running: `mysql --version` (on Windows, check Services)

### "Cannot read properties of undefined"
- **Solution**: Environment variables might not be loading
- Make sure `.env` is in the project root (same level as `package.json`)
- Restart your dev server after changing `.env`

### "Pool is closed"
- **Solution**: Hot-reloading can sometimes close the pool
- Just restart the dev server: Ctrl+C then `pnpm dev` again

---

## 🎓 Key Concepts You Just Learned

1. **API Routes** (`+server.ts`): Backend endpoints that run on the server
2. **Database Connection Pools**: Reusable connections for efficiency
3. **Environment Variables**: Secure way to store credentials
4. **Server-only Code** (`$lib/server`): Code that never reaches the browser
5. **TypeScript Interfaces**: Type safety for your data structures
6. **Error Handling**: Try/catch to gracefully handle database errors

---

## 📝 Summary

You now have a working foundation:
- SvelteKit app ✅
- MySQL connection ✅
- Health check endpoint ✅
- Type definitions ✅

This is your launchpad for all future features!

---

## 🚀 Next Steps

Ready to build something more interesting?

👉 **Continue to Milestone 1** (`milestone-1-session-explorer.md`) to build your first real feature: viewing session timelines!

---

## 💬 Questions to Ask Yourself (or Me!)

Before moving on, make sure you understand:
- ✓ What is a connection pool and why do we use it?
- ✓ Why do we separate server code into `src/lib/server/`?
- ✓ How do API routes (like `/api/health`) differ from page routes?
- ✓ What's the flow when you visit `/api/health` in your browser?

If any of these are unclear, ask for clarification! Understanding the foundation makes everything else easier.
