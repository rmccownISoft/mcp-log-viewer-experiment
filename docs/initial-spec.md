# MCP Log Explorer (SvelteKit 2.44+ / TS / adapter-node) — Dev Milestones (MySQL 5.7, meta=TEXT)

## Source table (actual schema)
Table: `errsole_logs_v3`

Key columns:
- `id` BIGINT PK (auto increment)
- `timestamp` TIMESTAMP(3) default CURRENT_TIMESTAMP(3)
- `hostname` VARCHAR(63) (customer code string-ish; not strictly int)
- `company_code` INT (may also be useful for filtering)
- `app_name` VARCHAR(255)
- `level` VARCHAR(31)
- `message` TEXT (FULLTEXT indexed)
- `meta` TEXT (JSON payload stored as text)

Indexes already present (useful):
- `KEY timestamp (timestamp, id)` (great for paging)
- `KEY hostname_4 (hostname, timestamp, id)` (great for customer + time)
- `FULLTEXT KEY message (message)` (good for text search)

## Constraints & implications
- MySQL 5.7
- `meta` is TEXT (not JSON type)
  - We should assume `meta` is *usually* JSON, but must handle invalid JSON safely.
  - Prefer parsing JSON in Node/TS rather than relying on MySQL JSON functions.
- No logging changes allowed.

---

# Recommended overall approach

## v1 (fast to ship)
Query `errsole_logs_v3` directly and parse `meta` in server code:
- SQL filters: hostname/company_code/app_name/level + pagination + optional fulltext search on `message`
- Normalize rows to an `Event` / `ToolRun` shape in Node
- UI: Session Explorer + Tool Runs + Prompt Summary + Export

## v2 (recommended soon after)
Add a derived/materialized table `mcp_tool_runs` populated from `errsole_logs_v3`:
- Makes prompt summary and version compare trivial + fast
- Great foundation for labeling workflows and exports
- Avoids MySQL 5.7 JSON limitations entirely

---

# Normalized shapes (what the app uses)

## Event (session timeline)
Fields:
- `id`, `timestamp`, `hostname`, `companyCode`, `appName`, `level`, `message`
- `sessionId` (from parsed meta, or message fallback if ever needed)
- `toolName` (optional)
- `userName` (optional)
- `userContext` (optional)
- `toolStatus`: `success | failure | unknown | none`
- `resultPreview` (optional)

## ToolRun (evaluation unit)
Fields:
- `id`, `timestamp`, `hostname`, `companyCode`, `appName`, `level`
- `sessionId`
- `toolName`
- `userContext`
- `status`: `success | failure | unknown`
- `durationMs` (from meta.tool.time)
- `mcpVersion` (from meta.gql[*].headers['User-Agent'] or apollo version)
- `errorClass` (for failures)
- `resultKind`: `json | text | html`
- `resultText`
- `gqlCount`
- (optional) `gqlTimesMs[]` / `gqlMaxTimeMs`

---

# Parsing rules (server-side, Node/TS)

## Parse meta safely
- `metaObj = tryParseJSON(row.meta)`; if fails -> `{}` and mark `metaParseError=true`

## Extract sessionId (prefer meta)
- `metaObj.sessionId`
- fallback (optional): parse from `message` if meta is missing (regex in Node)

## Tool detection
A row is a ToolRun candidate if:
- `metaObj.tool?.name` exists

## Status
- `failure` if `metaObj.tool?.result?.isError === true`
- `success` if `metaObj.tool?.result` exists and not error
- otherwise `unknown`

## Version extraction
- prefer: `metaObj.gql?.[0]?.headers?.['User-Agent']`
  - parse like `presage-api-mcp-server/0.2.0` -> version `0.2.0`
- else: `metaObj.gql?.[0]?.headers?.['apollographql-client-version']`
- else null

## durationMs
- parse `metaObj.tool?.time` like `"60230.12ms"` -> `60230.12`
  - store integer ms (rounded) for convenience

## resultKind
- if resultText looks like JSON and parses -> `json`
- else if contains `<html` etc -> `html`
- else `text`
Never render HTML; always display in code block.

## errorClass (failures)
- if contains `504` or `Gateway Time-out` -> `gateway_timeout_504`
- else if contains `timeout` -> `timeout_other`
- else if contains `GraphQL request failed` -> `graphql_failed_other`
- else `other`

---

# API endpoints (v1: query source table + parse in Node)

## Milestone 0 — Scaffold & DB connectivity
- SvelteKit 2.44+
- TypeScript
- `@sveltejs/adapter-node`
- mysql2 pool via env vars
- `GET /api/health` -> DB OK

Deliverables:
- Deployable Node build
- `/api/health`

---

## Milestone 1 — Session Explorer MVP
### Backend
`GET /api/sessions/:sessionId`

SQL approach (since meta is TEXT):
Option A (recommended): filter via FULLTEXT on message or LIKE on message for sessionId
- `WHERE message LIKE CONCAT('%session ''', ?, '''%')`
- OR `WHERE message LIKE CONCAT('%', ?, '%')` (simpler, likely fine at your size)

Additionally (if meta always has it and is valid JSON often):
- we can still *optionally* filter by parsing in Node:
  - pull a bounded recent set then filter by parsed meta.sessionId
Given volume is small, simplest is message LIKE.

Order:
- `ORDER BY timestamp ASC, id ASC`

### Frontend
- `/sessions` with input box
- `/sessions/[sessionId]` timeline + detail drawer
- Toggle “Tool-only”

Deliverables:
- Non-technical friendly session timeline

---

## Milestone 2 — Tool Runs Browser
### Backend
`GET /api/tool-runs?hostname=&companyCode=&appName=&level=&q=&limit=&offset=`

SQL filters:
- hostname/company_code/app_name/level
- paging by `(timestamp, id)` with ORDER timestamp DESC
- optional text search:
  - use FULLTEXT on `message` when `q` is provided:
    - `WHERE MATCH(message) AGAINST (? IN BOOLEAN MODE)`
  - (still parse meta in Node for tool fields)

In Node:
- parse meta
- keep only ToolRuns (`meta.tool.name`)
- apply additional filters:
  - toolName, status, version, userContext search

Frontend:
- `/tool-runs` page with filter controls + table + detail modal
- “Failures” quick filter

Deliverables:
- Browse tool runs by hostname + status + tool + version

---

## Milestone 3 — Prompt Summary + Version Compare
### Backend
- `GET /api/prompts/summary?...`
  - server aggregates ToolRuns by exact userContext string
- `GET /api/compare/user-context?...`
  - group by version and compute stats

Frontend:
- `/prompts`
  - grouped prompt table
  - click to compare by version + drill into example runs

Deliverables:
- Compare the same userContext across MCP versions

---

## Milestone 4 — Exports (evaluation substrate)
- `/api/export/tool-runs.csv?...`
- `/api/export/tool-runs.jsonl?...`
- Export buttons on Tool Runs and Prompt Summary pages

Deliverables:
- JSONL dataset for manual review pipelines

---

# v2 (recommended) — Derived table for normalized tool runs

## Why it’s useful here
Because `meta` is TEXT and MySQL 5.7 lacks modern JSON querying, a derived table:
- makes filtering, grouping, and comparing by version extremely easy
- reduces server-side scanning/parsing as data grows
- provides a stable place to attach labels later

## Table: `mcp_tool_runs`
Suggested schema:
- `log_id BIGINT PRIMARY KEY` (references errsole_logs_v3.id)
- `timestamp TIMESTAMP(3)`
- `hostname VARCHAR(63)`
- `company_code INT`
- `session_id VARCHAR(64)`
- `tool_name VARCHAR(128)`
- `user_context TEXT`
- `status VARCHAR(16)` (`success|failure|unknown`)
- `duration_ms INT NULL`
- `mcp_version VARCHAR(64) NULL`
- `error_class VARCHAR(64) NULL`
- `result_kind VARCHAR(16)` (`json|text|html`)
- `result_text MEDIUMTEXT`
- `app_name VARCHAR(255)`
- `level VARCHAR(31)`

Indexes:
- `(session_id, timestamp)`
- `(hostname, timestamp)`
- `(tool_name, status, timestamp)`
- `(mcp_version, tool_name)`

## Sync
- Backfill once from existing rows
- Incremental: poll for `id > last_synced_id` every N seconds/minutes (or on demand)

---

# Open questions (small, but helpful)
1) Do you have any other message formats besides:
   - `[enterprise-mcp] Tool 'X' called by user 'Y' in session 'Z'`
   If there are multiple, we’ll rely on meta parsing primarily, but it affects session search by message.

2) Is `sessionId` always a UUID format? (assumed yes)
   If so, we can validate input and avoid weird searches.

3) Should hostname be the main customer filter, or company_code, or both?
   (We can show both and allow filtering on either.)