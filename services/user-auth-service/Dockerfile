# ─────────────────────────────────────────────────────────────────────────────
# Multi-Stage Build — User Auth Microservice (Node.js / TypeScript)
#
# Stage 1  →  "deps"    Install only production  node_modules
# Stage 2  →  "builder" Install ALL deps, compile TypeScript → dist/
# Stage 3  →  "runner"  Lean production image: Node Alpine + dist + prod deps
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Production dependency installation ───────────────────────────────
FROM node:20-alpine AS deps

# Install OS-level build tools needed by native addons (bcrypt, etc.)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy only manifests first — leverages Docker layer cache.
# Re-run npm ci only when package-lock.json changes.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts


# ── Stage 2: TypeScript compiler ─────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies (including devDependencies for the compiler)
RUN npm ci --ignore-scripts

# Copy application source after dependency install for better cache hits
COPY src/ ./src/

# Compile TypeScript → dist/
RUN npm run build


# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser

WORKDIR /app

# Copy the compiled output and lean node_modules from previous stages
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=deps    --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --chown=appuser:nodejs package.json ./

# Switch to non-root user
USER appuser

# Document the port (does NOT publish it — that is done at runtime / in ECS)
EXPOSE 3001

# Healthcheck for Docker / ECS — aligns with GET /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Use exec form to ensure SIGTERM is forwarded directly to Node (not to sh)
ENTRYPOINT ["node", "dist/index.js"]
