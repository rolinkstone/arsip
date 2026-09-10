// ============================================================
// Router: Proxy ke aplikasi TALAWANG (data kegiatan & nominatif)
// Base URL: /api/talawang
//
// Backend ini meneruskan token Bearer user yang sedang login ke
// aplikasi talawang, sehingga hak akses data kegiatan mengikuti
// user yang sama (seolah-olah user memanggil talawang langsung).
// Target: TALAWANG_API_URL (default http://localhost:5000)
// ============================================================
const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const TALAWANG_BASE = (process.env.TALAWANG_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const isHttps = TALAWANG_BASE.startsWith('https://');
const agent = isHttps ? new https.Agent({ rejectUnauthorized: false }) : null;

async function forward(req, res, targetPath) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Tidak ada token untuk integrasi talawang' });
    }

    try {
        const resp = await axios.get(`${TALAWANG_BASE}${targetPath}`, {
            headers: { Authorization: auth },
            params: req.query,
            timeout: 20000,
            httpsAgent: agent
        });
        res.status(resp.status).json(resp.data);
    } catch (e) {
        const status = e.response?.status || 502;
        const msg = e.response?.data?.message || e.response?.data?.error || e.message;
        if (status === 401 || status === 403) {
            return res.status(status).json({ success: false, message: 'Anda tidak berhak mengakses data talawang ini' });
        }
        console.error('❌ Proxy talawang gagal:', e.message);
        res.status(status).json({ success: false, message: msg, detail: String(e.message) });
    }
}

// GET /kegiatan — daftar kegiatan (list) — terusan /api/kegiatan
router.get('/kegiatan', (req, res) => forward(req, res, '/api/kegiatan'));

// GET /kegiatan/:id — detail kegiatan + pegawai (terusan /api/kegiatan/:id/edit)
router.get('/kegiatan/:id', (req, res) => forward(req, res, `/api/kegiatan/${req.params.id}/edit`));

// GET /kegiatan/:id/detail — detail penuh kegiatan (terusan /api/kegiatan/:id/detail)
router.get('/kegiatan/:id/detail', (req, res) => forward(req, res, `/api/kegiatan/${req.params.id}/detail`));

module.exports = router;
