# C4Sketch server image (requirement:bun-backend). Projects live in the /data volume.
# docker run -p 8787:8787 -v "$PWD/design:/data" c4sketch --token alice:secret
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
VOLUME /data
EXPOSE 8787
# Binding every interface shares the projects, so the server asks for --token per user (or --allow-anonymous).
ENTRYPOINT ["bun", "server/main.ts", "/data", "--host", "0.0.0.0", "--port", "8787", "--no-open"]
