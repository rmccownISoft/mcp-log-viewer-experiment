import type { LogRow, LogMeta, Event, ToolRun } from './types'

// Parse the (hopefully) JSON from the meta column, returns empty obj if it fails
export function parseMeta(metaText: string, rowId?: number): LogMeta {
	try {
		return JSON.parse(metaText)
	} catch (error) {
		const metaLength = metaText.length
		const isTruncated = metaLength === 65535
		const preview = metaText.slice(-100) // Last 100 characters

		console.error('🔴 Failed to parse meta JSON column')
		console.error(`   Row ID: ${rowId ?? 'unknown'}`)
		console.error(
			`   Meta length: ${metaLength} bytes${isTruncated ? ' ⚠️  TRUNCATED AT TEXT LIMIT' : ''}`
		)
		console.error(`   Last 100 chars: ...${preview}`)
		console.error(`   Error: ${error}`)

		return {}
	}
}

// Extract sessionid from meta or message
export function extractSessionId(row: LogRow, metaObj: LogMeta): string | null {
	// First try: meta.sessionId
	if (metaObj.sessionId) {
		return metaObj.sessionId
	}

	// Second try: parse from message like "session 'abc-123-def'"
	const match = row.message.match(/session\s+'([^']+)'/i)
	if (match && match[1]) {
		return match[1]
	}

	return null
}

/**
 * Extract tool name from meta
 */
export function extractToolName(metaObj: LogMeta): string | null {
	return metaObj.tool?.name || null
}

/**
 * Extract user name from message
 * Looks for patterns like "called by user 'John Doe'"
 */
export function extractUserName(message: string): string | null {
	const match = message.match(/user\s+'([^']+)'/i)
	return match ? match[1] : null
}

/**
 * Extract user context (the prompt/question) from meta
 */
export function extractUserContext(metaObj: LogMeta): string | null {
	// Check tool.parameters.userContext first
	const paramsUserContext = metaObj.tool?.parameters?.userContext
	if (typeof paramsUserContext === 'string') {
		return paramsUserContext
	}
	return null
}

/**
 * Determine tool execution status
 */
export function getToolStatus(metaObj: LogMeta): 'success' | 'failure' | 'unknown' | 'none' {
	// If no tool in meta, this isn't a tool execution
	if (!metaObj.tool) {
		return 'none'
	}

	// Check if result indicates error
	if (metaObj.tool.result?.isError === true) {
		return 'failure'
	}

	// If we have a result and it's not an error, it's success
	if (metaObj.tool.result) {
		return 'success'
	}

	// Tool exists but status unclear
	return 'unknown'
}

/**
 * Get a preview of the result (first 100 chars)
 */
export function getResultPreview(metaObj: LogMeta): string | null {
	const result = metaObj.tool?.result
	if (!result) return null

	try {
		const resultStr = typeof result === 'string' ? result : JSON.stringify(result)

		return resultStr.length > 100 ? resultStr.substring(0, 100) + '...' : resultStr
	} catch {
		return null
	}
}

/**
 * Convert a database row to a normalized Event
 */
export function rowToEvent(row: LogRow): Event {
	const metaObj = parseMeta(row.meta, row.id)

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
	}
}

/**
 * Check if a parsed meta object represents a tool run
 */
export function isToolRun(metaObj: LogMeta): boolean {
	return metaObj?.tool?.name !== undefined
}

/**
 * Extract tool status from meta
 */
export function extractToolStatus(metaObj: LogMeta): 'success' | 'failure' | 'unknown' {
	if (metaObj?.tool?.result?.isError === true) {
		return 'failure'
	}
	if (metaObj?.tool?.result !== undefined) {
		return 'success'
	}
	return 'unknown'
}

/**
 * Extract MCP version from GraphQL headers
 * Prefers User-Agent, falls back to apollographql-client-version
 */
export function extractMcpVersion(metaObj: LogMeta): string | null {
	const userAgent = metaObj?.gql?.[0]?.headers?.['User-Agent']
	if (userAgent) {
		// Parse "presage-api-mcp-server/0.2.0" -> "0.2.0"
		const match = userAgent.match(/\/(\d+\.\d+\.\d+)/)
		if (match) return match[1]
	}

	const apolloVersion = metaObj?.gql?.[0]?.headers?.['apollographql-client-version']
	if (apolloVersion) return apolloVersion

	return null
}

/**
 * Parse duration from meta.tool.time like "60230.12ms" -> 60230
 */
export function extractDurationMs(metaObj: LogMeta): number | null {
	const timeStr = metaObj?.tool?.time
	if (!timeStr) return null

	const match = timeStr.match(/^([\d.]+)ms$/)
	if (match) {
		return Math.round(parseFloat(match[1]))
	}

	return null
}

/**
 * Classify error type for failed tool runs
 */
export function classifyError(resultText: string): string | null {
	if (!resultText) return null

	const lower = resultText.toLowerCase()

	if (lower.includes('504') || lower.includes('gateway time-out')) {
		return 'gateway_timeout_504'
	}
	if (lower.includes('timeout')) {
		return 'timeout_other'
	}
	if (lower.includes('graphql request failed')) {
		return 'graphql_failed_other'
	}

	return 'other'
}
/**
 * Determine result kind (json, html, or text)
 */
export function determineResultKind(resultText: string): 'json' | 'text' | 'html' {
	if (!resultText) return 'text'

	// Try to parse as JSON
	try {
		JSON.parse(resultText)
		return 'json'
	} catch {
		// Not JSON
	}

	// Check for HTML
	if (/<html|<div|<span|<!doctype/i.test(resultText)) {
		return 'html'
	}

	return 'text'
}

/**
 * Extract GraphQL call metadata
 */
export function extractGqlMetadata(metaObj: LogMeta): {
	gqlCount: number
	gqlMaxTimeMs: number | null
} {
	const gqlArray = metaObj?.gql
	if (!Array.isArray(gqlArray)) {
		return { gqlCount: 0, gqlMaxTimeMs: null }
	}

	const times = gqlArray.map((g: any) => g.time).filter((t: any) => typeof t === 'number')

	return {
		gqlCount: gqlArray.length,
		gqlMaxTimeMs: times.length > 0 ? Math.max(...times) : null
	}
}

/**
 * Transform a raw DB row into a ToolRun object
 */
export function parseToolRun(row: LogRow): ToolRun | null {
	const metaObj = parseMeta(row.meta, row.id)
	// Must have tool.name to be a valid tool run
	if (!isToolRun(metaObj)) {
		return null
	}

	const sessionId = extractSessionId(row, metaObj)
	if (!sessionId) {
		return null // Tool runs should always have a session
	}

	const status = extractToolStatus(metaObj)
	const resultText = metaObj?.tool?.result?.text || metaObj?.tool?.result?.error || ''

	const { gqlCount, gqlMaxTimeMs } = extractGqlMetadata(metaObj)

	return {
		id: row.id,
		timestamp: row.timestamp,
		hostname: row.hostname,
		companyCode: row.company_code,
		appName: row.app_name,
		level: row.level,
		sessionId,
		toolName: metaObj.tool?.name || '',
		userContext: extractUserContext(metaObj),
		status,
		durationMs: extractDurationMs(metaObj),
		mcpVersion: extractMcpVersion(metaObj),
		errorClass: status === 'failure' ? classifyError(resultText) : null,
		resultKind: determineResultKind(resultText),
		resultText,
		gqlCount,
		gqlMaxTimeMs
	}
}
