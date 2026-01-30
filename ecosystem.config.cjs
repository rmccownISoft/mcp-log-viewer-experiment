const dotenv = require('dotenv')
const path = require('path')

// Load .env file
const envConfig = dotenv.config({ path: path.join(__dirname, '.env') })

if (envConfig.error) {
	console.error('Error loading .env file:', envConfig.error)
} else {
	console.log('Successfully loaded .env file')
}

module.exports = {
	apps: [
		{
			name: 'mcp-log-viewer',
			script: './build/index.js',
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: '1G',
			cwd: __dirname,
			env: {
				...envConfig.parsed,
				NODE_ENV: 'production',
				PORT: 3001
			},
			error_file: './logs/pm2-error.log',
			out_file: './logs/pm2-out.log',
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			merge_logs: true
		}
	]
}
