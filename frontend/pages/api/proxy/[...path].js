// pages/api/proxy/[...path].js
/**
 * PROXY API — token Keycloak hanya ada di sisi server.
 * -------------------------------------------------------------
 * Sebelumnya token akses Keycloak ikut dikirim ke browser melalui
 * `/api/auth/session` lalu disimpan di localStorage/sessionStorage
 * (lihat riwayat: components/SessionSync.js). Akibatnya token — termasuk
 * refresh token — bisa dibaca skrip apa pun yang berjalan di origin ini
 * (XSS, ekstensi browser, skrip pihak ketiga), sehingga cookie sesi yang
 * sudah `httpOnly` jadi tidak ada gunanya.
 *
 * Sekarang browser TIDAK pernah memegang token:
 *   browser → /api/proxy/<path>   (cookie sesi httpOnly, terkirim otomatis)
 *   Next.js server → <backend>/api/<path>  + `Authorization: Bearer <token>`
 *
 * Token diambil dari cookie sesi NextAuth yang sudah terenkripsi (JWE) dan
 * tidak pernah ditulis ke body response maupun ke HTML.
 */
import { getToken } from 'next-auth/jwt';

// Body diteruskan apa adanya (JSON / multipart) — jangan di-parse di sini.
export const config = {
  api: { bodyParser: false },
};

// Nama cookie sesi harus SAMA dengan `cookies.sessionToken.name` di
// pages/api/auth/[...nextauth].js.
const NAMA_COOKIE_SESI = 'ecipar.next-auth.session-token';

// Batas ukuran body (backend sendiri membatasi JSON 10mb).
const BATAS_BODY = 25 * 1024 * 1024;

// Cetak PDF di server (Chrome headless) bisa lama; axios di sisi klien
// memakai timeout 30 detik, jadi batas di sini lebih longgar.
const TIMEOUT_MS = 60000;

const baseBackend = () =>
  (process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:5004/api'
  ).replace(/\/+$/, '');

export default async function handler(req, res) {
  // ---------- 1) Ambil token dari cookie sesi (server-side) ----------
  let sesi = null;
  try {
    sesi = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: NAMA_COOKIE_SESI,
    });
  } catch (err) {
    sesi = null;
  }

  const accessToken = sesi?.accessToken;
  if (!accessToken) {
    // Bentuk response disamakan dengan backend supaya utils/authInterceptor.js
    // tetap mengenalinya sebagai kegagalan sesi (401 -> redirect /login).
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized - Sesi tidak ditemukan atau sudah berakhir',
    });
  }

  // ---------- 2) Susun URL tujuan ----------
  // req.url = "/api/proxy/surattugas/12?tahun=2026" -> "/surattugas/12?tahun=2026"
  const jalur = String(req.url || '').replace(/^\/api\/proxy/, '');
  if (!jalur || jalur.includes('..') || jalur.includes('\\')) {
    return res.status(400).json({ success: false, message: 'Path tidak valid' });
  }

  // ---------- 3) Baca body mentah (kalau ada) ----------
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const potongan = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > BATAS_BODY) {
        return res.status(413).json({ success: false, message: 'Ukuran permintaan terlalu besar' });
      }
      potongan.push(chunk);
    }
    if (total > 0) body = Buffer.concat(potongan);
  }

  // ---------- 4) Teruskan ke backend ----------
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['accept']) headers['Accept'] = req.headers['accept'];

  const kontrol = new AbortController();
  const timer = setTimeout(() => kontrol.abort(), TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(`${baseBackend()}${jalur}`, {
      method: req.method,
      headers,
      body,
      signal: kontrol.signal,
      redirect: 'manual',
    });
  } catch (err) {
    const timeout = err?.name === 'AbortError';
    console.error(`[proxy] ${req.method} ${jalur} gagal:`, err?.message);
    return res.status(timeout ? 504 : 502).json({
      success: false,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      message: timeout ? 'Server terlalu lama merespons' : 'Gagal menghubungi server',
    });
  } finally {
    clearTimeout(timer);
  }

  // ---------- 5) Kembalikan response (termasuk PDF/blob) apa adanya ----------
  const isi = Buffer.from(await upstream.arrayBuffer());

  res.status(upstream.status);
  for (const nama of ['content-type', 'content-disposition', 'cache-control', 'location']) {
    const nilai = upstream.headers.get(nama);
    if (nilai) res.setHeader(nama, nilai);
  }
  // Header `set-cookie` dari backend sengaja TIDAK diteruskan: backend ini
  // tidak pernah menulis cookie, dan meneruskannya hanya menambah permukaan
  // serangan terhadap cookie sesi aplikasi.
  if (!isi.length) return res.end();
  return res.send(isi);
}
