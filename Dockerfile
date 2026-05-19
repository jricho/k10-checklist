# syntax=docker/dockerfile:1.7

# ---- deps: install production+build dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder: produce .next/standalone ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal production image ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# OpenShift runs containers as a random UID with GID 0. Make the app dir
# group-writable so the random UID (which is always in group 0) can read/write.
# Avoid hard-coding a USER that conflicts with the project's UID range.
RUN addgroup -S -g 1001 nodejs \
 && adduser  -S -u 1001 -G nodejs nextjs

# Standalone output contains server.js + a minimal node_modules tree.
COPY --chown=1001:0 --from=builder /app/public ./public
COPY --chown=1001:0 --from=builder /app/.next/standalone ./
COPY --chown=1001:0 --from=builder /app/.next/static ./.next/static

# Make writable paths group-writable so an arbitrary UID (member of root group
# under OpenShift's restricted-v2 SCC) can still write caches and logs.
RUN chmod -R g+rwX /app

USER 1001

EXPOSE 8080

# Use HTTP health probes from k8s/openshift instead of HEALTHCHECK — keeps the
# image runtime-agnostic and avoids duplicate probing.

CMD ["node", "server.js"]
