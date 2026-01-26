import type { LogRow, LogMeta, Event } from './types'

// Parse the (hopefully) JSON from the metal column, returns empty obj if it fails
export function parseMeta(metaText: string): LogMeta {
    try {
        return JSON.parse(metaText)
    } catch (error) {
        console.warn('Failed to parse meta JSON column: ', error)
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
    // This might be in different places depending on your logs
    // Adjust based on your actual data structure
    return metaObj.userContext || metaObj.prompt || null
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
        const resultStr = typeof result === 'string' 
            ? result 
            : JSON.stringify(result)
        
        return resultStr.length > 100 
            ? resultStr.substring(0, 100) + '...'
            : resultStr
    } catch {
        return null
    }
}

/**
 * Convert a database row to a normalized Event
 */
export function rowToEvent(row: LogRow): Event {
    const metaObj = parseMeta(row.meta)
    
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