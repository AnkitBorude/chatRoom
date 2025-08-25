# ------------------------------------------------
# Stage 1 – Build frontend bundle (using npx esbuild)
# ------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/public/src ./src

# Copy root-level tsconfig for path alias resolution
COPY tsconfig.json ./

# Copy frontend sources


# Copy shared code (for @shared/* imports)
COPY shared ./shared

# Bundle the entry file
# (Adjust entry file name if required)
RUN npx esbuild src/app.ts --bundle --outfile=app.js --minify


# ------------------------------------------------
# Stage 2 – Serve with nginx (SPA routing)
# ------------------------------------------------
FROM nginx:alpine

COPY --from=builder /app/app.js /usr/share/nginx/html/app.js

# Custom nginx config (contains SPA history fallback)
COPY frontend/nginx.conf /etc/nginx/nginx.conf


# Static files
COPY frontend/public/index.html /usr/share/nginx/html/
COPY frontend/public/assets  /usr/share/nginx/html/assets/
COPY frontend/public/style /usr/share/nginx/html/style/

# Bundle from the build stage


EXPOSE 80

# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]