FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS prod-deps
WORKDIR /app
COPY pnpm-lock.yaml /app/
RUN pnpm fetch --prod
COPY . /app
RUN pnpm install --offline --prod

FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml /app/
RUN pnpm fetch
COPY . /app
RUN pnpm install --offline
RUN pnpm exec svelte-kit sync
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/package.json
WORKDIR /app
EXPOSE 3000
CMD [ "node", "build/index.js" ]
