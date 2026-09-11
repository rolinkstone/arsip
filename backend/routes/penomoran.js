// ============================================================
// Router: Pengaturan Penomoran SPPD
// Base URL: /api/penomoran
//
// KHUSUS ADMIN ARSIPARIS (role admin_arsiparis).
//   GET  /?tahun=YYYY → { tahun, terakhir }  (nomor terakhir tahun tsb)
//   PUT  /            → setel { tahun, terakhir }  (nomor terakhir manual)
//   GET  /pratinjau?tahun=YYYY&jumlah=N → nomor yang AKAN dipakai
//
// Urutan nomor SPPD disimpan PER TAHUN (nomor_sppd_terakhir_<tahun>) —
// lihat utils/penomoran.js.
//
// Catatan: middleware auth (verifikasi token Keycloak) sudah dipasang global
// di server.js, jadi di sini cukup memeriksa role.
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { roleInfo } = require('../utils/suratHelpers');
const { bacaSetting, simpanSetting, pratinjauNomorSppd } = require('../utils/penomoran');

/** Hanya admin arsiparis yang boleh membaca/mengubah penomoran. */
function hanyaAdmin(req, res, next) {
    if (!roleInfo(req).isAdminArsiparis) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin Arsiparis yang dapat mengatur penomoran' });
    }
    next();
}

// ============================================================
// GET /?tahun=YYYY — baca setting penomoran satu tahun
// (tanpa ?tahun → tahun berjalan)
// ============================================================
router.get('/', hanyaAdmin, async (req, res) => {
    try {
        const setting = await bacaSetting(req.query?.tahun, db);
        res.json({ success: true, data: setting });
    } catch (e) {
        console.error('❌ GET /penomoran:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// PUT / — setel "nomor terakhir" (manual)
// body: { tahun, terakhir }
// ============================================================
router.put('/', hanyaAdmin, async (req, res) => {
    const { tahun, terakhir } = req.body || {};
    try {
        const setting = await simpanSetting({ tahun, terakhir }, db);
        res.json({
            success: true,
            message: `Nomor terakhir tahun ${setting.tahun} disetel ke ${setting.terakhir}. SPPD berikutnya: ${setting.terakhir + 1}.`,
            data: setting,
        });
    } catch (e) {
        // kesalahan validasi (tahun/nomor) → 400, bukan 500
        const salahIsi = /tidak valid/i.test(e.message);
        if (salahIsi) console.warn('⚠️ PUT /penomoran (masukan tidak valid):', e.message);
        else console.error('❌ PUT /penomoran:', e);
        res.status(salahIsi ? 400 : 500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /pratinjau?tahun=&jumlah= — nomor yang akan dipakai (tidak mengubah apa pun)
// ============================================================
router.get('/pratinjau', hanyaAdmin, async (req, res) => {
    try {
        const { tahun, jumlah } = req.query || {};
        const hasil = await pratinjauNomorSppd({ tahun, jumlah }, db);
        res.json({ success: true, data: hasil });
    } catch (e) {
        console.error('❌ GET /penomoran/pratinjau:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
