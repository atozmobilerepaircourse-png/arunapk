FROM node:20-slim AS base

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY patches/ ./patches/

RUN npm install --production=false

COPY shared/ ./shared/
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY app.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./

RUN npm run server:build

FROM node:20-slim AS production

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY patches/ ./patches/

RUN npm install --production

COPY --from=base /app/server_dist/ ./server_dist/
COPY --from=base /app/shared/ ./shared/
COPY server/templates/ ./server/templates/
COPY app.json ./
COPY static-build/ ./static-build/
COPY assets/ ./assets/

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server_dist/index.js"]
