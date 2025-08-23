# ---------- Builder Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install TypeScript globally for compilation

# Copy root-level package.json + package-lock.json
COPY package*.json ./

# Install only prod dependencies (we don’t need dev deps in prod image)
RUN npm ci --include=dev

# Copy backend + shared + tsconfig
COPY tsconfig.json ./         
COPY shared ./shared
COPY backend ./backend

# Compile backend TS -> JS
RUN npx tsc -p backend/tsconfig.json

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only prod deps from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled backend dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared ./shared

# Start the backend
CMD ["node", "backend/dist/index.js"]