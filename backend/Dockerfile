FROM node:18-alpine
# Catatan: Node 18 sudah EOL. Pertimbangkan naik ke node:22-alpine saat ada waktu
# untuk menguji ulang (frontend memakai node:20-alpine).

WORKDIR /usr/src/app

# Chromium untuk fitur "Unduh PDF": backend/utils/pdfRender.js memakai Chrome
# headless lewat puppeteer-core. Tanpa ini tombol "Unduh PDF" gagal dengan pesan
# "Chrome/Edge tidak ditemukan."
#   - Paket `chromium` di Alpine memasang /usr/bin/chromium (atau
#     /usr/bin/chromium-browser). Kedua jalur itu sudah ada di daftar pencarian
#     pdfRender.js, jadi CHROME_PATH tidak wajib diisi.
#   - Font "Bookman Old Style" TIDAK tersedia di Linux, jadi PDF di server memakai
#     font pengganti (fallback di CSS: Georgia / Times New Roman). Bila jarak baris
#     atau paginasi PDF di server berbeda dari preview di Windows, sebabnya ini.
#     Solusi: pasang font Bookman di server (mis. mount font dari host).
#   - Bila PDF di server tidak diperlukan, baris RUN ini boleh dihapus agar image
#     jauh lebih kecil.
#   - Nama paket sudah dicek di Alpine: `chromium` (community, ±236MB terpasang)
#     dan `font-freefont` (main). PERHATIAN: `ttf-freefont` TIDAK ADA di Alpine —
#     kalau ditulis begitu, `apk add` gagal dan build ikut gagal.
#   - Pemasangan font dibuat "best effort" (|| echo) supaya build tidak gagal
#     kalau nama paket font berbeda di versi Alpine lain.
RUN apk add --no-cache chromium \
    && (apk add --no-cache font-freefont || echo 'font-freefont tidak tersedia - memakai font bawaan')

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