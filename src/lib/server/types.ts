import type { RowDataPacket } from 'mysql2'

// Raw row from the database
export interface LogRow extends RowDataPacket {
	id: number
	hostname: string
	pid: number
	source: string
	timestamp: Date
	level: string // info, debug, warn, error?
	message: string
	meta: string
	errsole_id: number
	app_name: string
	company_code: number
}

export interface ToolResult {
	text?: string
	type?: string
}
// Parsed meta field structure (what we expect in the JSON)
export interface LogMeta {
	sessionId?: string
	tool?: {
		name?: string
		log?: Array<string>
		time?: string // e.g., "60230.12ms"
		parameters?: Record<string, unknown> // Dynamic key-value parameters
		result?: {
			isError?: boolean
			content: Array<ToolResult>
			[key: string]: any
		}
	}
	gql?: Array<{
		headers?: {
			'User-Agent'?: string
			'apollographql-client-version'?: string
		}
		query?: string
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

// Type for dynamic parameters object with unknown keys
// Option 1: Most flexible - allows any value type
export type Parameters = Record<string, any>

// Option 2: Type-safe - requires type checking before use (recommended)
export type ParametersSafe = Record<string, unknown>

// Option 3: Restricted to common parameter types
export type ParametersStrict = Record<string, string | number | boolean | null | undefined>

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
	parameters?: ParametersStrict // Add parameters field
	status: 'success' | 'failure' | 'unknown'
	durationMs: number | null
	mcpVersion: string | null
	//errorClass: string | null
	//resultKind: 'json' | 'text' | 'html'
	resultText: Array<string> | null
	gqlCount: number
	gqlMaxTimeMs: number | null
	timestamp?: Date
	gqlQuery: string | null
}

export interface PromptSummary {
	userContext: string
	toolName: string
	totalRuns: number
	successCount: number
	failureCount: number
	successRate: number
	avgDurationMs: number | null
	minDurationMs: number | null
	maxDurationMs: number | null
	versionsUsed: string[]
	exampleRunIds: number[] // not sure?
}

export interface VersionComparison {
	userContext: string
	toolName: string

	byVersion: {
		version: string
		totalRuns: number
		successCount: number
		failureCount: number
		successRate: number
		avgDurationMs: number | null
		exampleRunIds: number[]
	}[]
}
