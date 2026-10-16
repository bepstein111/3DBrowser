# Stage 1: build the frontend
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve the built app with Caddy
FROM caddy:2-alpine

COPY --from=build /app/dist /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
