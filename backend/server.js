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
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5004;

// ========== MIDDLEWARE DASAR ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ========== KEYCLOAK CONFIG ==========
const KEYCLOAK_CONFIG = {
    url: process.env.KEYCLOAK_URL || process.env.KEYCLOAK_SERVER_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'local-surat',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || ''
};

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

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
        const decoded = jwt.decode(token);
        if (!decoded || (decoded.exp && decoded.exp < Date.now() / 1000)) {
            return res.status(401).json({ success: false, message: 'Token invalid or expired' });
        }

        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.realm_access?.roles || []
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
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
