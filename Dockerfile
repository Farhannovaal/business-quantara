
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

RUN DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" npm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Next.js standalone runtime
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Scripts used by notification worker
COPY --from=builder /app/scripts ./scripts

# Include complete dependencies for both Next.js and worker
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "server.js"]
