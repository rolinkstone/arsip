// ============================================================
// Router: Proxy ke aplikasi TALAWANG (data kegiatan & nominatif)
// Base URL: /api/talawang
//
// Backend ini meneruskan token Bearer user yang sedang login ke
// aplikasi talawang, sehingga hak akses data kegiatan mengikuti
// user yang sama (seolah-olah user memanggil talawang langsung).
// Target: TALAWANG_API_URL (default http://localhost:5000)
//
// ============================================================
// FITUR "CARI NOMINATIF MILIK ORANG LAIN" (2026-09-12)
// ------------------------------------------------------------
// MASALAH: di talawang, user biasa hanya melihat kegiatan MILIKNYA
// (`WHERE user_id = ?`). Akibatnya, bila A membuat nominatif berisi A dan B,
// si B tidak bisa menemukan/mengambil nominatif itu untuk membuat Surat Tugas.
//
// SOLUSI (SELURUHNYA DI SISI PERSURATAN — talawang TIDAK diubah):
//   1. Cari memakai token user seperti biasa → hasil LAMA tidak pernah dikurangi
//      (admin / PPK / kabalai tetap melihat seperti sebelumnya).
//   2. Cari lagi memakai token admin (server-ke-server; token ini tidak pernah
//      dikirim ke browser) untuk melihat SELURUH kegiatan.
//   3. Hasil tambahan HANYA diberikan bila user benar-benar terdaftar sebagai
//      PESERTA NOMINATIF kegiatan itu (dicocokkan lewat NIP; cadangan: nama).
//   4. Saat user membuka kegiatan (ambil daftar peserta + PPK), bila talawang
//      menolak (403/404) karena bukan pembuat, permintaan diulang dengan token
//      admin ASALKAN keanggotaan nominatifnya terbukti.
//
// Jadi user biasa tetap TIDAK bisa melihat kegiatan orang lain secara bebas —
// hanya kegiatan yang memang memuat dia di dalam nominatifnya.
// ============================================================
const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { getAdminCliToken } = require('../utils/keycloakHelpers');

const TALAWANG_BASE = (process.env.TALAWANG_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const isHttps = TALAWANG_BASE.startsWith('https://');
const agent = isHttps ? new https.Agent({ rejectUnauthorized: false }) : null;

// Status kegiatan yang layak dipakai untuk Surat Tugas
// (sama dengan filter KEGIATAN_STATUS_VISIBLE di FormSuratTugas.js)
const STATUS_LAYAK = ['diketahui', 'disetujui', 'selesai'];

// Batas jumlah kegiatan yang dicek keanggotaan nominatifnya per pencarian,
// supaya jumlah permintaan ke talawang tetap wajar.
const MAKS_PERIKSA = 20;

// ---------- cache in-memory (token admin & daftar peserta) ----------
const TTL_MS = 5 * 60 * 1000;
let cacheTokenAdmin = { nilai: null, kedaluwarsa: 0 };
const cachePeserta = new Map(); // idKegiatan -> { waktu, pegawai }

async function ambilTokenAdmin() {
    if (cacheTokenAdmin.nilai && Date.now() < cacheTokenAdmin.kedaluwarsa) return cacheTokenAdmin.nilai;
    const token = await getAdminCliToken();
    cacheTokenAdmin = { nilai: token, kedaluwarsa: Date.now() + TTL_MS };
    return token;
}

/** Daftar peserta (nominatif) sebuah kegiatan — memakai token admin. */
async function ambilPeserta(idKegiatan, token) {
    const kunci = String(idKegiatan);
    const c = cachePeserta.get(kunci);
    if (c && Date.now() - c.waktu < TTL_MS) return c.pegawai;

    try {
        const resp = await axios.get(`${TALAWANG_BASE}/api/kegiatan/${kunci}/edit`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
            httpsAgent: agent
        });
        const pegawai = resp.data?.data?.pegawai || [];
        cachePeserta.set(kunci, { waktu: Date.now(), pegawai });
        return pegawai;
    } catch (e) {
        console.warn(`⚠️ Gagal ambil nominatif kegiatan ${kunci}:`, e.response?.status || e.message);
        // kegagalan cukup di-cache sebentar (30 detik)
        cachePeserta.set(kunci, { waktu: Date.now() - TTL_MS + 30000, pegawai: [] });
        return [];
    }
}

const bersihNip = (v) => String(v === null || v === undefined ? '' : v).replace(/\s/g, '');

/** Identitas user yang sedang login (dari token yang sudah diverifikasi server ini). */
function identitas(req) {
    const u = req.user || {};
    const kandidatNip = [u.username, u.nip, u.preferred_username, u.name]
        .find((v) => v && /^\d[\d\s]*$/.test(String(v)));
    return {
        userKey: u.id || null,
        nip: kandidatNip ? bersihNip(kandidatNip) : '',
        nama: String(u.name || '').trim().toLowerCase()
    };
}

/** Apakah user terdaftar sebagai peserta pada daftar pegawai nominatif? */
function pegawaiCocok(pegawai, id) {
    const daftar = Array.isArray(pegawai) ? pegawai : [];
    return daftar.some((p) => {
        if (id.nip) return bersihNip(p?.nip) === id.nip;
        if (id.nama) return String(p?.nama || '').trim().toLowerCase() === id.nama;
        return false;
    });
}

/** Cek keanggotaan nominatif sebuah kegiatan (memakai token admin). */
async function penggunaPesertaKegiatan(req, idKegiatan) {
    const id = identitas(req);
    if (!id.nip && !id.nama) return false;
    try {
        const pegawai = await ambilPeserta(idKegiatan, await ambilTokenAdmin());
        return pegawaiCocok(pegawai, id);
    } catch (e) {
        console.warn('⚠️ Cek peserta nominatif gagal:', e.message);
        return false;
    }
}

// ---------- helper proxy umum ----------
function kirimErrorTalawang(res, e) {
    const status = e.response?.status || 502;
    const msg = e.response?.data?.message || e.response?.data?.error || e.message;
    if (status === 401 || status === 403) {
        return res.status(status).json({ success: false, message: 'Anda tidak berhak mengakses data talawang ini' });
    }
    console.error('❌ Proxy talawang gagal:', e.message);
    return res.status(status).json({ success: false, message: msg, detail: String(e.message) });
}

async function getTalawang(targetPath, token, params) {
    return axios.get(`${TALAWANG_BASE}${targetPath}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 20000,
        httpsAgent: agent
    });
}

// ============================================================
// GET /kegiatan — daftar kegiatan (terusan /api/kegiatan)
// ===== ditambah: nominatif tempat user terdaftar sebagai peserta =====
// query yang diteruskan: ?search=…&status=…
// ============================================================
router.get('/kegiatan', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Tidak ada token untuk integrasi talawang' });
    }
    const tokenUser = auth.slice('Bearer '.length);

    // ===== 1) hasil dengan token user sendiri (perilaku lama, tidak dikurangi) =====
    let hasilUser = [];
    let errorUser = null;
    try {
        const resp = await getTalawang('/api/kegiatan', tokenUser, req.query);
        hasilUser = resp.data?.data || [];
    } catch (e) {
        errorUser = e;
    }

    // ===== 2) cari lagi dengan token admin untuk menemukan nominatif orang lain =====
    let hasilAdmin = [];
    try {
        const tokenAdmin = await ambilTokenAdmin();
        const resp = await getTalawang('/api/kegiatan', tokenAdmin, req.query);
        hasilAdmin = resp.data?.data || [];
    } catch (e) {
        console.warn('⚠️ Pencarian talawang dengan token admin gagal:', e.response?.status || e.message);
    }

    // Dua-duanya gagal → sampaikan error seperti sebelumnya
    if (errorUser && !hasilAdmin.length) return kirimErrorTalawang(res, errorUser);

    // ===== 3) verifikasi keanggotaan nominatif untuk kandidat tambahan =====
    const id = identitas(req);
    const sudahAda = new Set(hasilUser.map((k) => String(k?.id)));
    const kandidat = hasilAdmin
        .filter((k) => k && !sudahAda.has(String(k.id)))
        .filter((k) => STATUS_LAYAK.includes(String(k.status || '').toLowerCase()))
        .slice(0, MAKS_PERIKSA);

    const tambahan = [];
    if (kandidat.length && (id.nip || id.nama)) {
        try {
            const tokenAdmin = await ambilTokenAdmin();
            const dicek = await Promise.all(kandidat.map(async (k) => {
                const pegawai = await ambilPeserta(k.id, tokenAdmin);
                return pegawaiCocok(pegawai, id) ? { ...k, dari_nominatif: true } : null;
            }));
            for (const k of dicek) if (k) tambahan.push(k);
        } catch (e) {
            console.warn('⚠️ Verifikasi nominatif gagal:', e.message);
        }
    }

    const data = [...hasilUser, ...tambahan];
    res.json({ success: true, message: 'Daftar kegiatan berhasil diambil', data, count: data.length });
});

// ============================================================
// GET /kegiatan/:id — detail kegiatan + pegawai (terusan /api/kegiatan/:id/edit)
// Bila user bukan pembuat (403/404) tapi terdaftar di nominatif, permintaan
// diulang memakai token admin supaya daftar peserta tetap bisa diambil.
// ============================================================
router.get('/kegiatan/:id', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Tidak ada token untuk integrasi talawang' });
    }
    const target = `/api/kegiatan/${req.params.id}/edit`;

    try {
        const resp = await getTalawang(target, auth.slice('Bearer '.length), req.query);
        return res.status(resp.status).json(resp.data);
    } catch (e) {
        const status = e.response?.status || 502;

        // Bukan pembuat → tapi mungkin peserta nominatif kegiatan itu
        if ((status === 403 || status === 404) && (await penggunaPesertaKegiatan(req, req.params.id))) {
            try {
                const tokenAdmin = await ambilTokenAdmin();
                const resp = await getTalawang(target, tokenAdmin, req.query);
                console.log(`ℹ️ Kegiatan ${req.params.id} dibuka sebagai peserta nominatif oleh ${req.user?.username || req.user?.name}`);
                return res.status(resp.status).json(resp.data);
            } catch (e2) {
                console.warn('⚠️ Buka kegiatan via token admin gagal:', e2.response?.status || e2.message);
            }
        }

        return kirimErrorTalawang(res, e);
    }
});

// ============================================================
// GET /kegiatan/:id/detail — detail penuh kegiatan (terusan /api/kegiatan/:id/detail)
// ============================================================
router.get('/kegiatan/:id/detail', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Tidak ada token untuk integrasi talawang' });
    }
    try {
        const resp = await getTalawang(`/api/kegiatan/${req.params.id}/detail`, auth.slice('Bearer '.length), req.query);
        res.status(resp.status).json(resp.data);
    } catch (e) {
        kirimErrorTalawang(res, e);
    }
});

module.exports = router;
