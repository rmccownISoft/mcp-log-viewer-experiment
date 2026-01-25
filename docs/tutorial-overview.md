# MCP Log Explorer - Tutorial Overview

## 🎯 What You're Building

A web application to explore and analyze MCP (Model Context Protocol) tool execution logs stored in a MySQL database. Think of it as a detective tool for understanding how AI tools are being used, which ones succeed or fail, and what prompts work best.

## 🧩 The Big Picture: How the Pieces Connect

```
┌─────────────────────────────────────────────────────────────┐
│                    Your SvelteKit App                        │
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Frontend   │◄────────┤   Backend    │                  │
│  │  (Svelte)    │         │ (API Routes) │                  │
│  │              │         │              │                  │
│  │ • Sessions   │  fetch  │ • Parse logs │                  │
│  │ • Tool Runs  │ ──────► │ • Query DB   │                  │
│  │ • Prompts    │         │ • Transform  │                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                          │
└───────────────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  MySQL Database  │
                          │                  │
                          │ errsole_logs_v3  │
                          │  • Raw log data  │
                          │  • JSON in TEXT  │
                          └──────────────────┘
```

### Key Concepts

**1. SvelteKit = Frontend + Backend in One**
- Unlike React (frontend only), SvelteKit handles both UI and server logic
- Your app has two sides:
  - **Routes (frontend)**: Pages users see (`/sessions`, `/tool-runs`)
  - **API Routes (backend)**: Server endpoints that talk to the database (`/api/sessions`)

**2. The Data Flow**
```
User clicks → Svelte page → fetch() → API route → MySQL query → 
Parse JSON → Transform data → JSON response → Svelte page → Display
```

**3. Why We Parse in Node (not MySQL)**
- Your `meta` column stores JSON but as TEXT (not MySQL's JSON type)
- MySQL 5.7 doesn't have good JSON functions anyway
- So we query the data, then parse the JSON in TypeScript (safer, more flexible)

## 📚 Tutorial Structure

Each milestone builds on the previous one. Complete them in order!

### **Milestone 0: Foundation** 🏗️
*Before you can display logs, you need a working app that can talk to the database*

**Mental Model**: Setting up the pipes and connections
- Get SvelteKit running
- Connect to MySQL
- Create a health check to prove it works

**Time**: 30-60 minutes  
**Output**: Running app with `/api/health` endpoint

---

### **Milestone 1: Session Explorer** 🔍
*Show all log events for a specific session (a user's conversation with the AI)*

**Mental Model**: Timeline viewer - like reading a story chronologically
- A session = all the things that happened during one user interaction
- You'll search by session ID and show events in order
- Build your first real page + API route

**Time**: 1-2 hours  
**Output**: `/sessions/[sessionId]` page showing event timeline

---

### **Milestone 2: Tool Runs Browser** 🔧
*Browse and filter all tool executions across all sessions*

**Mental Model**: The main dashboard - like a search engine for tool usage
- Filter by customer, app, tool name, success/failure
- See which tools are being called most often
- This is where you'll spend most of your analysis time

**Time**: 2-3 hours  
**Output**: `/tool-runs` page with filters and detail view

---

### **Milestone 3: Prompt Summary** 📊
*Group identical prompts and compare results across different MCP versions*

**Mental Model**: A/B testing view - "Did version 0.2.0 work better than 0.1.5?"
- Same prompt might be used many times
- Different MCP versions might handle it differently
- Aggregate stats help you see patterns

**Time**: 1-2 hours  
**Output**: `/prompts` page with grouping and comparison

---

### **Milestone 4: Data Export** 📥
*Download filtered data as CSV or JSONL for external analysis*

**Mental Model**: The exit door - get data out for spreadsheets or ML pipelines
- Add export buttons to existing pages
- Generate files on-the-fly from queries

**Time**: 30-60 minutes  
**Output**: Export endpoints and download buttons

---

## 🎓 Prerequisites You Should Know

### SvelteKit Basics (you said you know these!)
- ✅ File-based routing: `src/routes/about/+page.svelte` → `/about`
- ✅ Components: Reusable UI pieces
- ✅ `$:` reactive statements

### What You'll Learn
- 🆕 API Routes: `+server.ts` files that handle backend logic
- 🆕 Server Load Functions: `+page.server.ts` for server-side data loading
- 🆕 MySQL with Node: Using `mysql2` to query databases
- 🆕 Type-safe data transformations: TypeScript interfaces for clean code
- 🆕 URL search params: `/tool-runs?status=failure&hostname=acme`

## 🛠️ Tech Stack

| What | Why |
|------|-----|
| **SvelteKit 2.44+** | Full-stack framework (frontend + backend) |
| **TypeScript** | Type safety prevents bugs |
| **adapter-node** | Deploys as a standalone Node.js server |
| **mysql2** | Fast MySQL client for Node |
| **Vanilla CSS** | Keep it simple (you can add Tailwind later) |

## 📁 Project Structure You'll Build

```
mcp-log-viewer-experiment/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Home page
│   │   ├── +layout.svelte            # Shared layout/nav
│   │   ├── sessions/
│   │   │   └── [sessionId]/
│   │   │       ├── +page.svelte      # Session detail page
│   │   │       └── +page.server.ts   # Server data loader
│   │   ├── tool-runs/
│   │   │   ├── +page.svelte          # Tool runs browser
│   │   │   └── +page.server.ts
│   │   ├── prompts/
│   │   │   └── ...
│   │   └── api/
│   │       ├── health/
│   │       │   └── +server.ts        # GET /api/health
│   │       ├── sessions/
│   │       │   └── [sessionId]/
│   │       │       └── +server.ts    # GET /api/sessions/:id
│   │       ├── tool-runs/
│   │       │   └── +server.ts        # GET /api/tool-runs
│   │       └── export/
│   │           └── ...
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.ts                 # MySQL connection pool
│   │   │   ├── types.ts              # TypeScript interfaces
│   │   │   └── parsers.ts            # JSON parsing logic
│   │   └── components/
│   │       └── ...                   # Reusable UI components
│   └── app.html
├── docs/
│   ├── initial-spec.md               # Original requirements
│   ├── tutorial-overview.md          # This file!
│   ├── milestone-0-foundation.md
│   ├── milestone-1-session-explorer.md
│   ├── milestone-2-tool-runs-browser.md
│   ├── milestone-3-prompt-summary.md
│   └── milestone-4-exports.md
├── package.json
└── svelte.config.js
```

## 🚀 Getting Started

1. **Read this overview** to understand the big picture
2. **Start with Milestone 0** (`milestone-0-foundation.md`)
3. **Complete each milestone in order**
4. **Ask clarifying questions** whenever something is unclear
5. **Test as you go** - verify each piece works before moving on

## 💡 Learning Tips for Your Style

Since you mentioned you:
- ✨ **Learn best from examples**: Each milestone includes complete code examples
- 🧠 **Build mental models**: Each milestone starts with "How This Works" sections
- 🎯 **Get distracted by details**: Milestones focus on *what* and *why* before *how*
- 🔗 **Need to see connections**: Diagrams show how pieces interact

### When You Get Stuck
1. Re-read the "Mental Model" section
2. Look at the data flow diagram
3. Check the example code
4. Ask for clarification on the specific part that's confusing

## 📋 Progress Tracker

Track your progress through the milestones:

- [ ] **Milestone 0**: App running, DB connected, health check works
- [ ] **Milestone 1**: Can view a session's event timeline
- [ ] **Milestone 2**: Can browse and filter tool runs
- [ ] **Milestone 3**: Can see prompt summaries and compare versions
- [ ] **Milestone 4**: Can export data to CSV/JSONL

## 🔄 Future Enhancements (v2)

After completing all milestones, you might want to:
- Add a materialized `mcp_tool_runs` table for better performance
- Implement labeling workflows for evaluation
- Add real-time log streaming
- Build dashboards with charts

But focus on v1 first!

---

## Ready to Start?

👉 **Open `milestone-0-foundation.md` and let's build the foundation!**
