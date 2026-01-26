/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
    const params = new URLSearchParams();
    
    // Extract query parameters from URL
    const hostname = url.searchParams.get('hostname');
    const companyCode = url.searchParams.get('companyCode');
    const appName = url.searchParams.get('appName');
    const level = url.searchParams.get('level');
    const textSearch = url.searchParams.get('q');
    const toolName = url.searchParams.get('toolName');
    const status = url.searchParams.get('status');
    const version = url.searchParams.get('version');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    
    if (hostname) params.set('hostname', hostname);
    if (companyCode) params.set('companyCode', companyCode);
    if (appName) params.set('appName', appName);
    if (level) params.set('level', level);
    if (textSearch) params.set('q', textSearch);
    if (toolName) params.set('toolName', toolName);
    if (status) params.set('status', status);
    if (version) params.set('version', version);
    params.set('limit', limit);
    params.set('offset', offset);
    
    try {
        const response = await fetch(`${url.origin}/api/tool-runs?${params}`);
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        return {
            toolRuns: data.toolRuns,
            hasMore: data.hasMore,
            initialFilters: {
                hostname,
                companyCode,
                appName,
                level,
                textSearch,
                toolName,
                status,
                version,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        };
    } catch (err) {
        console.error(err);
        return {
            toolRuns: [],
            hasMore: false,
            error: 'Failed to load tool runs',
            initialFilters: {
                hostname,
                companyCode,
                appName,
                level,
                textSearch,
                toolName,
                status,
                version,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        };
    }
}
