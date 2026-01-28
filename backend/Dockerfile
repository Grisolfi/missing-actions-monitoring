# --- Stage 1: Builder ---
FROM cgr.dev/chainguard/node:latest-dev AS builder

# Switch to root to ensure we can set up the directory
USER root
WORKDIR /app
RUN chown node:node /app

# Switch back to node for safety
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

RUN npm install

COPY --chown=node:node . .

# Generate Prisma client and build
RUN npx prisma generate && npm run build

# --- Stage 2: Pruner (Production Dependencies) ---
FROM cgr.dev/chainguard/node:latest-dev AS pruner

USER root
WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/

# Install only production dependencies
RUN npm ci --omit=dev

# --- Stage 3: Runner (Minimal Production Runtime) ---
FROM cgr.dev/chainguard/node:latest AS runner

WORKDIR /app

# Note: Chainguard latest image is extremely minimal (no shell, no apk).
# It already includes the necessary runtime libraries for Node.js.

# Copy only necessary artifacts
COPY --from=pruner --chown=node:node /app/node_modules ./node_modules
# Crucial: Copy the generated Prisma client from builder to runner's node_modules
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Chainguard image runs as 'node' user by default
USER node

EXPOSE 3000

ENV NODE_ENV=production

# Health check - Note: fetch is native in Node 21+
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD [ "node", "-e", "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" ]

ENTRYPOINT ["node"]
CMD ["--max-old-space-size=192", "dist/api/server.js"]
