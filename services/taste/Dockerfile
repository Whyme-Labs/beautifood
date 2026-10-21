# The taste service: Node 22 and Qloo's harness, as the hackathon kit asks for a server or container.
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 QLOO_HOME=/home/node/.qloo-state
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs ./
RUN mkdir -p "$QLOO_HOME" && chown node:node "$QLOO_HOME"
USER node
ENV PATH=/app/node_modules/.bin:$PATH
EXPOSE 8080
CMD ["node", "server.mjs"]
