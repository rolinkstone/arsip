// ============================================================
// Router: Pengaturan — PEJABAT PENANDATANGAN (nama Kepala Balai)
// Base URL: /api/pejabat
//
//   GET /  → { success, data: { kepala_nama, maks_panjang } }
//            (SEMUA user yang sudah login boleh membaca — halaman cetak
//             butuh nilai ini untuk mencetak nama pejabat)
//   PUT /  → ubah nama (KHUSUS admin_arsiparis)
//            body: { kepalaNama }
//
// Nilai disimpan di tabel app_setting dengan kunci `ttd_kepala_nama`
// (lihat utils/pengaturan.js). Nilai ini juga disuntikkan ke
// GET /api/surattugas/:id sebagai `ttd_kepala_nama`, sehingga cetak
// Surat Tugas, lampiran, dan SPD selalu memakai nama TERBARU.
//
// Catatan: middleware auth (verifikasi token Keycloak) sudah dipasang global
// di server.js, jadi di sini cukup memeriksa role.
// ============================================================
const express = require('express');
const router = express.Router();
const { roleInfo } = require('../utils/suratHelpers');
const {
    bacaKepalaNama, simpanKepalaNama, MAKS_PANJANG_NAMA,
} = require('../utils/pengaturan');

/** Hanya admin arsiparis yang boleh MENGUBAH nama pejabat. */
function hanyaAdmin(req, res, next) {
    if (!roleInfo(req).isAdminArsiparis) {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak: hanya Admin Arsiparis yang dapat mengubah nama pejabat penandatangan',
        });
    }
    next();
}

// ============================================================
// GET / — nama Kepala Balai yang berlaku
// ============================================================
router.get('/', async (req, res) => {
    try {
        const kepalaNama = await bacaKepalaNama();
        res.json({
            success: true,
            data: { kepala_nama: kepalaNama, maks_panjang: MAKS_PANJANG_NAMA },
        });
    } catch (e) {
        console.error('❌ GET /pejabat:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// PUT / — setel nama Kepala Balai
// body: { kepalaNama }
// ============================================================
router.put('/', hanyaAdmin, async (req, res) => {
    const { kepalaNama } = req.body || {};
    try {
        const baru = await simpanKepalaNama(kepalaNama);
        res.json({
            success: true,
            message: `Nama Kepala Balai disimpan: ${baru}. Cetak Surat Tugas, lampiran, dan SPD berikutnya memakai nama ini.`,
            data: { kepala_nama: baru, maks_panjang: MAKS_PANJANG_NAMA },
        });
    } catch (e) {
        // kesalahan validasi → 400, bukan 500
        const salahIsi = /tidak valid/i.test(e.message);
        if (salahIsi) console.warn('⚠️ PUT /pejabat (masukan tidak valid):', e.message);
        else console.error('❌ PUT /pejabat:', e);
        res.status(salahIsi ? 400 : 500).json({ success: false, message: e.message });
    }
});

module.exports = router;
