FROM node:22-bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Railway's /backend context may not contain initialized Git submodules.
# Fetch the exact source revision rather than silently building the latest tag.
COPY nocobase-revision ./nocobase-revision
RUN git init nocobase \
    && cd nocobase \
    && git remote add origin https://github.com/nocobase/nocobase.git \
    && git fetch --depth=1 origin "$(cat /app/nocobase-revision)" \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$(cat /app/nocobase-revision)" \
    && node -e "const fs=require('node:fs');fs.writeFileSync('yarn.lock',fs.readFileSync('yarn.lock','utf8').replaceAll('https://registry.npmmirror.com/','https://registry.npmjs.org/'))" \
    && yarn config set registry https://registry.npmjs.org/ \
    && yarn install --frozen-lockfile --production=false --network-timeout 600000 \
    && yarn cache clean

COPY services/object-storage/package.json services/object-storage/package-lock.json ./services/object-storage/
RUN npm ci --prefix services/object-storage --omit=dev --ignore-scripts \
    && npm cache clean --force

COPY package.json ./
COPY scripts ./scripts
COPY src ./src
COPY config ./config
COPY packages ./packages
COPY services/object-storage/index.mjs ./services/object-storage/
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run crm:build -- --no-dts \
    && node scripts/check-production.mjs \
    && rm -rf nocobase/.git

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production APP_ENV=production APP_HOST=0.0.0.0 \
    APP_PUBLIC_PATH=/crm/ API_BASE_PATH=/api/ WS_PATH=/ws \
    PLUGIN_STATICS_PATH=/static/plugins/ LOGGER_LEVEL=warn \
    STORAGE_PATH=/app/storage/nocobase
COPY --from=build /app /app
RUN mkdir -p /app/storage /app/nocobase/storage

# One Node process handles NocoBase, CRM, prospects and publication.
CMD ["node", "scripts/start.mjs"]
