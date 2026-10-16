# Stage 1: build the frontend
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve the frontend and the filesystem API from a single Node process
FROM node:24-alpine

WORKDIR /app

COPY server ./server
COPY --from=build /app/dist ./dist

ENV ROOT=/models
ENV STATIC_DIR=/app/dist
ENV APP_PORT=8080
EXPOSE $APP_PORT

CMD ["node", "server/index.mjs"]
