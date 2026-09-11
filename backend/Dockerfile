FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Catatan: TIDAK ada lagi `COPY .env.production .env` di sini.
# Variabel lingkungan dikirim oleh docker-compose.yml saat runtime (bagian
# `environment:`). Keuntungannya:
#   1) image TIDAK menyimpan rahasia (password DB / client secret Keycloak);
#   2) build tidak gagal di server — `backend/.env.production` ter-ignore oleh
#      git (lihat .gitignore: `.env.*`), jadi file itu TIDAK IKUT saat deploy
#      via git, padahal perintah COPY akan error bila filenya tidak ada.
# Bila ingin menjalankan image ini tanpa compose, kirim variabelnya lewat
# `docker run --env-file ...`.

EXPOSE 5004

CMD ["node", "server.js"]