export async function load({ fetch, url }) {
	const params = new URLSearchParams({
		minOccurrences: '1'
	})

	// You can also read initial filters from URL search params if desired
	const hostname = url.searchParams.get('hostname')
	const toolName = url.searchParams.get('toolName')

	if (hostname) params.set('hostname', hostname)
	if (toolName) params.set('toolName', toolName)

	// Fetch summaries and app names in parallel
	const [summariesResponse, appNamesResponse] = await Promise.all([
		fetch(`/api/prompts/summary?${params}`),
		fetch(`/api/app-names`)
	])

	const summariesData = await summariesResponse.json()
	const appNamesData = await appNamesResponse.json()

	return {
		summaries: summariesData.summaries || [],
		appNames: appNamesData.appNames || [],
		initialFilters: { hostname: hostname || '', toolName: toolName || '', minOccurrences: 1 }
	}
}
