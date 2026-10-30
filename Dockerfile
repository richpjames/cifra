# Cifra — static site + SQLite song library in one tiny image.
# Node 24: node:sqlite is stable there (server.js also runs on 22+).
FROM node:24-alpine
WORKDIR /app
COPY index.html server.js ./
# /data holds cifra.db — mount a Coolify persistent volume here
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=8765 CIFRA_DB=/data/cifra.db
EXPOSE 8765
# / is public (the API needs auth when CIFRA_TOKEN is set), so probe that
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8765/ >/dev/null || exit 1
CMD ["node","server.js"]
