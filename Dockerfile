# superpower MCP server — production image
# Build: docker build -t superpower .
# Run:   docker run -p 8787:8787 -e DATABASE_URL=... -e SUPERPOWER_API_KEYS=... \
#          -e ANTHROPIC_API_KEY=... superpower
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json VERSION ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY bin ./bin
COPY package.json VERSION ./
EXPOSE 8787
USER node
CMD ["node", "--no-warnings", "bin/superpower.js", "serve", "--http", "--port", "8787"]
