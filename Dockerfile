# syntax=docker/dockerfile:1

# ---------- deps: todas as dependências + Prisma Client gerado ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- migrator: aplica migrações e seed (executa uma vez e encerra) ----------
FROM deps AS migrator
# O seed importa dados fixos de src/lib (regras PPI, matriz curricular, blocos de horário).
COPY src/lib/ppi-regras-2022.ts ./src/lib/
COPY src/lib/disciplinas/matriz-curricular.ts ./src/lib/disciplinas/
COPY src/lib/grade/blocos-horario.ts ./src/lib/grade/
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---------- builder: build de produção do Next.js ----------
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner: imagem final mínima ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ é opcional; descomente quando existir:
# COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
