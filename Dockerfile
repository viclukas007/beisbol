FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3080
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY data/seed.json ./data/seed.json
COPY data/schedule.json ./data/schedule.json
USER node
EXPOSE 3080
CMD ["node", "server/server.ts"]
