export async function load({ fetch, url }) {
	const params = new URLSearchParams({
		minOccurrences: '1'
	})

	// You can also read initial filters from URL search params if desired
	const hostname = url.searchParams.get('hostname')
	const toolName = url.searchParams.get('toolName')

	if (hostname) params.set('hostname', hostname)
	if (toolName) params.set('toolName', toolName)

	const response = await fetch(`/api/prompts/summary?${params}`)
	const data = await response.json()

	return {
		summaries: data.summaries || [],
		initialFilters: { hostname: hostname || '', toolName: toolName || '', minOccurrences: 1 }
	}
}
