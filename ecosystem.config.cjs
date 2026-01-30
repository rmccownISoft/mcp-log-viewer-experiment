module.exports = {
	apps: [
		{
			name: 'mcp-log-viewer',
			script: './build/index.js',
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '1G',
			// Use dotenv to load .env file
			node_args: '-r dotenv/config',
			env: {
				NODE_ENV: 'production',
				PORT: 3001
				// Fallback: You can also specify critical env vars here directly
				// But .env file will take precedence if loaded
			},
			error_file: './logs/pm2-error.log',
			out_file: './logs/pm2-out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			merge_logs: true
		}
	]
}
