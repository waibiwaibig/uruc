FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY packages/server/package.json packages/server/
COPY packages/human-web/package.json packages/human-web/
RUN npm install --workspace=packages/server --workspace=packages/human-web
COPY packages/server packages/server
COPY packages/human-web packages/human-web
RUN npm run build --workspace=packages/server && npm run build --workspace=packages/human-web

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/packages/human-web/dist ./public
RUN npm install --omit=dev
EXPOSE 3000 3001
ENV DB_PATH=/data/uruc.db
ENV PUBLIC_DIR=/app/public
ENV PLUGIN_CONFIG_PATH=/app/plugins.prod.json
COPY --from=builder /app/packages/server/plugins.prod.json ./plugins.prod.json
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
