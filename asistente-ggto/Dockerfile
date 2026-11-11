FROM node:22-alpine
WORKDIR /app
COPY server.js index.html ./
# Canon v2-A5: solo dependencia nativa ligera (mongodb para el registro de uso)
RUN npm install --omit=dev --no-audit --no-fund mongodb@6 2>&1 | tail -1
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
