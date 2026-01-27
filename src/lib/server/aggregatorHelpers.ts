import type { ToolRun, PromptSummary, VersionComparison } from './types'

// Group tool runs by userContext and calculate statistics

export function aggregateByPrompt(toolRuns: ToolRun[]): PromptSummary[] {
	// Group by userContext + toolName combination
	const groups = new Map<string, ToolRun[]>()

	for (const run of toolRuns) {
		const key = `${run.toolName}::${run.userContext}`
		if (!groups.has(key)) {
			groups.set(key, [])
		}
		groups.get(key)!.push(run)
	}

	// Calculating stats?
	const summaries: PromptSummary[] = []

	for (const [key, runs] of groups.entries()) {
		const [toolName, userContext] = key.split('::', 2)

		const successCount = runs.filter((r) => r.status === 'success').length
		const failureCount = runs.filter((r) => r.status === 'failure').length

		// Calculate duration stats (only for runs with duration data)
		const durationsMs = runs.map((r) => r.durationMs).filter((d): d is number => d !== null)

		const avgDurationMs =
			durationsMs.length > 0
				? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length
				: null

		const minDurationMs = durationsMs.length > 0 ? Math.min(...durationsMs) : null

		const maxDurationMs = durationsMs.length > 0 ? Math.max(...durationsMs) : null

		// Collect unique versions
		const versionsUsed = [
			...new Set(runs.map((r) => r.mcpVersion).filter((v): v is string => v !== null))
		].sort()

		// Get example run IDs (first 5)
		const exampleRunIds = runs.slice(0, 5).map((r) => r.id)

		summaries.push({
			userContext,
			toolName,
			totalRuns: runs.length,
			successCount,
			failureCount,
			//successRate: runs.length > 0 ? (successCount / runs.length) * 100 : 0,
			avgDurationMs: avgDurationMs ? Math.round(avgDurationMs) : null,
			minDurationMs,
			maxDurationMs,
			versionsUsed,
			exampleRunIds
		})
	}

	// Sort by total runs?
	return summaries.sort((a, b) => b.totalRuns - a.totalRuns)
}

/**
 * Compare a specific prompt across different MCP versions
 */
export function compareByVersion(
	toolRuns: ToolRun[],
	userContext: string,
	toolName: string
): VersionComparison | null {
	// Filter to just this prompt
	const matchingRuns = toolRuns.filter(
		(r) => r.userContext === userContext && r.toolName === toolName
	)

	if (matchingRuns.length === 0) {
		return null
	}

	// Group by version
	const byVersionMap = new Map<string, ToolRun[]>()

	for (const run of matchingRuns) {
		const version = run.mcpVersion || 'unknown'
		if (!byVersionMap.has(version)) {
			byVersionMap.set(version, [])
		}
		byVersionMap.get(version)!.push(run)
	}

	// Calculate stats per version
	const byVersion = Array.from(byVersionMap.entries()).map(([version, runs]) => {
		const successCount = runs.filter((r) => r.status === 'success').length
		const failureCount = runs.filter((r) => r.status === 'failure').length

		const durationsMs = runs.map((r) => r.durationMs).filter((d): d is number => d !== null)

		const avgDurationMs =
			durationsMs.length > 0
				? Math.round(durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length)
				: null

		const exampleRunIds = runs.slice(0, 3).map((r) => r.id)

		return {
			version,
			totalRuns: runs.length,
			successCount,
			failureCount,
			successRate: runs.length > 0 ? (successCount / runs.length) * 100 : 0,
			avgDurationMs,
			exampleRunIds
		}
	})

	// Sort by version string
	byVersion.sort((a, b) => a.version.localeCompare(b.version))

	return {
		userContext,
		toolName,
		byVersion
	}
}
