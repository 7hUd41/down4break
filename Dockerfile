# syntax=docker/dockerfile:1.7

# Multi-stage build pour un runtime image léger (Next.js standalone output).
# Pattern recommandé par https://nextjs.org/docs/app/building-your-application/deploying

# ---- 1) deps : install all deps (incl. dev) pour le build ----
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat : nécessaire pour certains binaires natifs sur Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 2) builder : build Next.js en mode standalone ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Le télémétrie Next.js : on coupe (rien à voir avec Anthropic, c'est Vercel)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3) runner : image minimale qui tourne en prod ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# User non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# On copie le minimum : le bundle standalone, les assets statiques, et public/
# Le standalone embarque déjà server.js + node_modules requis.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# server.js est généré automatiquement par output: 'standalone'
CMD ["node", "server.js"]
