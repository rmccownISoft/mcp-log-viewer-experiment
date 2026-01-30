# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv create --template minimal --types ts --add eslint tailwindcss="plugins:none" sveltekit-adapter="adapter:node" --install pnpm mcp-log-viewer-experiment
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

```sh
NODE_OPTIONS="--max-old-space-size=768" pnpm -s build
```

```sh
PORT=3001 pm2 start build/index.js --name mcp-log-viewer
```

```sh
pnpm add dotenv
pm2 delete mcp-log-viewer
pm2 start build/index.js --node-args="-r dotenv/config" --name "mcp-log-viewer"
pm2 save
```

# 1. Build with new logging

pnpm build

# 2. On your VM, restart PM2 with dotenv

pm2 delete mcp-log-viewer
pm2 start build/index.js --node-args="-r dotenv/config" --name "mcp-log-viewer"
pm2 save

# 3. Watch the startup logs

pm2 logs mcp-log-viewer --lines 50

```sh
sudo systemctl restart caddy
```

keep

#trying again

# 1. Upload/copy the updated .env and ecosystem.config.cjs to your VM

# 2. If you have ecosystem.config.js, rename it on Linux:

mv ecosystem.config.js ecosystem.config.cjs

# 3. Build the app (if you haven't already)

pnpm build

# 4. Stop any existing PM2 process

pm2 delete mcp-log-viewer

# 5. Start with the ecosystem config

pm2 start ecosystem.config.cjs

# 6. Save PM2 process list

pm2 save

# 7. Watch the logs to verify it's working

pm2 logs mcp-log-viewer --lines 50
