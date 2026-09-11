// backend/server.js
/**
 * ============================================================
 *  BACKEND MINIMAL (Template Aplikasi Baru)
 * ============================================================
 *  Yang dipertahankan:
 *    - POST /api/login    → login via Keycloak (password grant)
 *    - GET  /api/health   → health check
 *    - /api/keycloak      → router utility Keycloak (satu-satunya router fitur)
 *
 *  Seluruh router fitur lama (aset, laporanrusak, persediaan, dll.)
 *  sudah dihapus. Tambahkan router aplikasi baru di bagian "ROUTES".
 * ============================================================
 */
const express = require('express');
const cors = require('cors');
const https = require('https');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5004;

// ========== MIDDLEWARE DASAR ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- CORS ----------
// Hanya origin lokal/jaringan privat + daftar di CORS_ORIGIN (pisahkan dengan koma).
// Tanpa Origin (curl, server-ke-server, headless print) tetap diizinkan.
const originDiizinkan = (process.env.CORS_ORIGIN || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

function originBoleh(origin) {
    if (!origin) return true;
    if (originDiizinkan.includes(origin)) return true;
    try {
        const { hostname, protocol } = new URL(origin);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return true;
        // alamat privat (aplikasi ini dipakai di jaringan kantor)
        if (/^10\./.test(hostname)) return true;
        if (/^192\.168\./.test(hostname)) return true;
        if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
        return false;
    } catch (e) {
        return false;
    }
}

app.use(cors({
    origin(origin, cb) {
        if (originBoleh(origin)) return cb(null, true);
        console.warn('⛔ CORS ditolak untuk origin:', origin);
        return cb(null, false);   // tanpa header CORS → browser memblokir
    }
}));

// ---------- Anti brute-force untuk login ----------
// (sebelumnya /api/login bebas dicoba sebanyak apa pun)
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,     // 15 menit
    limit: 10,                    // 10 percobaan per IP per jendela
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' }
});
app.use('/api/login', loginLimiter);

// ========== KEYCLOAK CONFIG ==========
const KEYCLOAK_CONFIG = {
    url: process.env.KEYCLOAK_URL || process.env.KEYCLOAK_SERVER_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'local-surat',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || ''
};

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

// ========== VERIFIKASI TANDA TANGAN TOKEN (JWKS Keycloak) ==========
// PENTING: sebelumnya token hanya di-DECODE (baca base64) tanpa verifikasi tanda tangan,
// sehingga siapa pun bisa mengarang token (mis. mengaku admin) lalu mengakses semua data.
// Sekarang tanda tangan diverifikasi memakai public key (JWKS) milik realm Keycloak.
let jwksCache = { keys: null, at: 0 };

async function getJwks(force = false) {
    const masihSegar = jwksCache.keys && (Date.now() - jwksCache.at) < 10 * 60 * 1000;
    if (masihSegar && !force) return jwksCache.keys;

    const url = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/certs`;
    const res = await axios.get(url, { httpsAgent, timeout: 10000 });
    jwksCache = { keys: res.data?.keys || [], at: Date.now() };
    return jwksCache.keys;
}

async function verifikasiToken(token) {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.payload) throw new Error('format token tidak dikenali');

    const payload = decoded.payload;
    if (payload.exp && payload.exp < Date.now() / 1000) throw new Error('token kedaluwarsa');

    let keys = await getJwks();
    let jwk = keys.find((k) => k.kid === decoded.header.kid);
    if (!jwk) {
        // kemungkinan public key baru dirotasi → ambil ulang sekali
        keys = await getJwks(true);
        jwk = keys.find((k) => k.kid === decoded.header.kid) || keys[0];
    }
    if (!jwk) throw new Error('public key tidak ditemukan');

    // Kalau tanda tangan tidak cocok / token palsu, baris ini melempar error.
    jwt.verify(token, jwkToPem(jwk), { algorithms: ['RS256'] });
    return payload;
}

// ========== AUTH MIDDLEWARE ==========
// Public route yang TIDAK membutuhkan token
const publicRoutes = ['/api/login', '/api/health'];

const authMiddleware = async (req, res, next) => {
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    try {
        // Verifikasi tanda tangan token ke Keycloak (bukan sekadar decode).
        const decoded = await verifikasiToken(token);

        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.realm_access?.roles || []
        };
        next();
    } catch (error) {
        console.warn('⛔ Token ditolak:', error.message);
        return res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
    }
};

app.use(authMiddleware);

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

// ========== LOGIN (Keycloak password grant) ==========
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password required' });
    }

    try {
        const response = await axios.post(
            `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
            qs.stringify({
                grant_type: 'password',
                client_id: KEYCLOAK_CONFIG.clientId,
                client_secret: KEYCLOAK_CONFIG.clientSecret,
                username,
                password,
                scope: 'openid profile email'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, httpsAgent }
        );

        const decoded = jwt.decode(response.data.access_token);
        res.json({
            success: true,
            data: {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                user: {
                    id: decoded?.sub,
                    username: decoded?.preferred_username || username,
                    email: decoded?.email,
                    name: decoded?.name,
                    roles: decoded?.realm_access?.roles || []
                }
            }
        });
    } catch (error) {
        const status = error.response?.status === 401 ? 401 : 500;
        res.status(status).json({
            success: false,
            message: error.response?.status === 401 ? 'Username atau password salah' : 'Login failed'
        });
    }
});

// ========== ROUTES ==========
// Satu-satunya router fitur yang dipertahankan: Keycloak utility.
// Tambahkan router aplikasi baru Anda di sini, mis.:
//   app.use('/api/foo', require('./routes/foo'));
app.use('/api/keycloak', require('./routes/keycloak'));

// ===== MODUL PERSURATAN (ST & SPPD) =====
app.use('/api/surattugas', require('./routes/surattugas'));
app.use('/api/dasaraturan', require('./routes/dasaraturan'));
app.use('/api/penomoran', require('./routes/penomoran'));
app.use('/api/talawang', require('./routes/talawang'));

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.path} tidak ditemukan` });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    console.error('Global error:', err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on port ${PORT}
    📋 Routes:
    - POST  /api/login
    - GET   /api/health
    - GET   /api/keycloak/*
    - GET/POST /api/surattugas/*
    - GET     /api/dasaraturan/*
    - GET     /api/talawang/*
    ════════════════════════════════════════
    `);
});

module.exports = app;
