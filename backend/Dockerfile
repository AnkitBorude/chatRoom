# ---------- Builder Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root-level package.json + package-lock.json
COPY package*.json ./

# Install all deps (prod + dev, since we need tsc in build stage)
RUN npm ci --include=dev

# Copy tsconfig + backend + shared
COPY tsconfig.json ./
COPY shared ./shared
COPY backend ./backend

# Compile backend TS -> JS
RUN npx tsc -p backend/tsconfig.json && npx tsc-alias -p backend/tsconfig.json

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only prod deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled dist + shared
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared

EXPOSE 3000
# Start the backend
CMD ["node", "dist/backend/index.js"]