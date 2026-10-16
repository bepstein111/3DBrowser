FROM node:24-alpine

WORKDIR /app

COPY server ./server

ENV ROOT=/models
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/index.mjs"]
