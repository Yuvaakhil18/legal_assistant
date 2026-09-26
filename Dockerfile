FROM node:20-alpine AS builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Copy SQL migrations (since they aren't compiled by TS)
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

EXPOSE 3000
CMD ["node", "dist/server.js"]
