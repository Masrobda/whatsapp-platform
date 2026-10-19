# Étape 1 : Builder (avec Python et outils de compilation)
FROM node:20-alpine AS builder

# Installer Python + build tools pour node-gyp
RUN apk add --no-cache python3 make g++ py3-pip

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

# Étape 2 : Image finale ultra-légère (sans Python/build tools)
FROM node:20-alpine AS runner

WORKDIR /app

# Créer utilisateur non-root
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

# Copier uniquement ce qui est nécessaire
COPY --from=builder --chown=nextjs:nodejs /app /app

USER nextjs

EXPOSE 3001

# Lancement via PM2 (comme dans ton ecosystem.config.js)
CMD ["npx", "pm2-runtime", "ecosystem.config.js", "--only", "nextltd-api,whatsapp-worker,storage-cleaner,cron-clean-messages"]
