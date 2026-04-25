FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/plugin-sdk/package.json packages/plugin-sdk/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/plugins/chess/package.json packages/plugins/chess/
COPY packages/plugins/fleamarket/package.json packages/plugins/fleamarket/
COPY packages/plugins/park/package.json packages/plugins/park/
COPY packages/plugins/social/package.json packages/plugins/social/

RUN npm ci

COPY packages/plugin-sdk packages/plugin-sdk
COPY packages/server packages/server
COPY packages/web packages/web
COPY packages/plugins/chess packages/plugins/chess
COPY packages/plugins/fleamarket packages/plugins/fleamarket
COPY packages/plugins/park packages/plugins/park
COPY packages/plugins/social packages/plugins/social

RUN npm run build --workspace=@uruc/plugin-sdk \
  && npm run build --workspace=@uruc/server \
  && npm run build --workspace=packages/web

RUN node --input-type=module -e "import path from 'path'; import { syncCityLock } from './packages/server/dist/cli/lib/city.js'; const packageRoot = path.resolve('./packages/server'); await syncCityLock({ configPath: path.join(packageRoot, 'uruc.city.json'), lockPath: path.join(packageRoot, 'uruc.city.lock.json'), packageRoot, pluginStoreDir: path.join(packageRoot, '.uruc', 'plugins') });"

RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/plugin-sdk ./packages/plugin-sdk
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/uruc.city.json ./packages/server/uruc.city.json
COPY --from=builder /app/packages/server/uruc.city.lock.json ./packages/server/uruc.city.lock.json
COPY --from=builder /app/packages/server/.uruc ./packages/server/.uruc
COPY --from=builder /app/packages/web/dist ./public

WORKDIR /app/packages/server
EXPOSE 3000 3001
ENV DB_PATH=/data/uruc.db
ENV PUBLIC_DIR=/app/public
ENV CITY_CONFIG_PATH=/app/packages/server/uruc.city.json
ENV CITY_LOCK_PATH=/app/packages/server/uruc.city.lock.json
ENV PLUGIN_STORE_DIR=/app/packages/server/.uruc/plugins
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
