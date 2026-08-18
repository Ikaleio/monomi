FROM oven/bun:1 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    MONOMI_HOST=0.0.0.0 \
    MONOMI_PORT=3000 \
    MONOMI_DATA_DIR=/data
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY --from=build /app/build/client ./build/client
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data && chown -R bun:bun /app /data
USER bun
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:3000/health');process.exit(r.ok?0:1)"]
CMD ["bun", "server/index.ts"]
