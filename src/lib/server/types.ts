// Raw row from the database
export interface LogRow {
  id: number
  hostname: string 
  pid: number 
  source: string
  timestamp: string
  level: string // info, debug, warn, error?
  message: string
  meta: string
  errsole_id: number
  app_name: string
  company_code: number
}

// Parsed meta field structure (what we expect in the JSON)
export interface LogMeta {
  sessionId?: string
  tool?: {
    name?: string
    time?: string // e.g., "60230.12ms"
    result?: {
      isError?: boolean
      [key: string]: any
    }
  }
  gql?: Array<{
    headers?: {
      'User-Agent'?: string
      'apollographql-client-version'?: string
    }
  }>
  [key: string]: any // Allow other unknown fields
}

// Normalized event for the frontend
export interface Event {
  id: number
  timestamp: Date
  hostname: string
  companyCode: number
  appName: string
  level: string
  message: string
  sessionId: string | null
  toolName: string | null
  userName: string | null
  userContext: string | null
  toolStatus: 'success' | 'failure' | 'unknown' | 'none'
  resultPreview: string | null
}

// Normalized tool run for analysis
export interface ToolRun {
  id: number
  hostname: string
  companyCode: number
  appName: string
  level: string
  sessionId: string
  toolName: string
  userContext: string | null
  status: 'success' | 'failure' | 'unknown'
  durationMs: number | null
  mcpVersion: string | null
  errorClass: string | null
  resultKind: 'json' | 'text' | 'html'
  resultText: string
  gqlCount: number
}
