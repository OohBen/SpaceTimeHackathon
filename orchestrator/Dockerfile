# Live LLM queue worker for Solar Dominion.
# Build context: the orchestrator/ workspace (self-contained — no workspace-internal deps).
# Coolify: set Base Directory = /orchestrator, Dockerfile location = ./Dockerfile.
FROM node:22-slim

WORKDIR /app

# Install deps (incl. tsx, used to run the TS worker directly).
COPY package.json ./
RUN npm install --no-audit --no-fund

# App source (includes generated module_bindings committed by `npm run generate`).
COPY . .

ENV NODE_ENV=production
ENV LLM_MODE=live
ENV SPACETIME_URI=wss://maincloud.spacetimedb.com
ENV SPACETIME_DB_NAME=solar-dominion
# OPENROUTER_API_KEY and OPENROUTER_MODEL are injected as Coolify env/secrets.

CMD ["npm", "run", "worker"]
