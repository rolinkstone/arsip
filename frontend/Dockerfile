FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json ./

# Clean npm cache dan install dependencies
RUN npm cache clean --force && \
    npm ci --no-audit --legacy-peer-deps

# Copy source code
COPY . .

# Env variabel untuk build — Next.js me-bake NEXT_PUBLIC_* saat build,
# jadi harus diisi dari build args (bukan runtime). Nilai dari compose build.args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_KEYCLOAK_ISSUER
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_KEYCLOAK_ISSUER=$NEXT_PUBLIC_KEYCLOAK_ISSUER
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID

# Build aplikasi Next.js
RUN npm run build

# Set environment variable untuk port
# ⭐ PASTIKAN PORT 3005 untuk Next.js
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Expose port yang benar
EXPOSE 3005

# Start aplikasi
CMD ["npm", "start"]