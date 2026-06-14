# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
# Prisma needs OpenSSL present to pick the right engine on Alpine (musl).
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# libssl for the Prisma query/schema engines (migrate deploy at startup).
RUN apk add --no-cache openssl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Job photos land here unless S3 is configured. For persistence across
# redeploys, attach storage at this path (a Railway Volume, or a compose
# volume locally). Note: a Dockerfile VOLUME instruction is intentionally
# omitted — Railway's builder rejects it.
ENV UPLOAD_DIR=/data/uploads

EXPOSE 3001
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
