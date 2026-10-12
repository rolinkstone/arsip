// ============================================================
// Router: Modul Nota Dinas (ND)
// Base URL: /api/notadinas
//
// Alur (SAMA dengan Surat Tugas):
//   user membuat ND (draft) -> ajukan
//   -> katim verifikasi (disetujui / dikembalikan)
//   -> admin_arsiparis penomoran (terbit)
//
// Perbedaan dengan Surat Tugas: ND tidak punya peserta/SPPD. Isi ND adalah
// teks bebas (kolom `isi`) dan nomor ND diisi MANUAL oleh admin arsiparis
// memakai format resmi (mis. "KA.04.01.16A.04.24.20").
//
// Catatan: middleware auth (verifikasi token Keycloak) sudah dipasang global
// di server.js, jadi di sini cukup memakai identitas & peran dari req.user.
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const {
    getIdentity, roleInfo, toSqlDate
} = require('../utils/suratHelpers');
const { bacaKepalaNama } = require('../utils/pengaturan');

const STATUS_TERLIHAT_KATIM = ['diajukan', 'disetujui', 'dikembalikan', 'terbit'];
const STATUS_TERLIHAT_ADMIN = ['disetujui', 'terbit'];

// ---------- helper: NIP dari username Keycloak (preferred_username = NIP) ----------
function nomorDariUsername(username) {
    return username && /^\d[\d\s]*$/.test(String(username)) ? String(username).replace(/\s/g, '') : null;
}

// ---------- helper: teks bersih (trim + batas panjang) ----------
function teks(v, maks = null) {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/\r\n/g, '\n').trim();
    if (!s) return null;
    return maks ? s.slice(0, maks) : s;
}

// ---------- helper: catat log workflow ----------
async function catatLog(ndId, aksi, req, catatan = '', conn = null) {
    const { user_key, username } = getIdentity(req);
    const q = 'INSERT INTO nota_dinas_log (nota_dinas_id, aksi, user_key, username, catatan) VALUES (?,?,?,?,?)';
    const params = [ndId, aksi, user_key, username, catatan];
    if (conn) await conn.query(q, params);
    else await db.query(q, params);
}

// ---------- helper: ambil detail lengkap ND ----------
async function getDetail(ndId) {
    const [rows] = await db.query('SELECT * FROM nota_dinas WHERE id = ?', [ndId]);
    if (rows.length === 0) return null;
    const nd = rows[0];

    const [log] = await db.query(
        'SELECT * FROM nota_dinas_log WHERE nota_dinas_id = ? ORDER BY id DESC', [ndId]);
    nd.log = log;
    nd.tanggal_nd = toSqlDate(nd.tanggal_nd);

    // Nama Kepala Balai GLOBAL (Pengaturan → Pejabat Penandatangan) sebagai
    // CADANGAN untuk ND lama yang belum punya snapshot sendiri.
    nd.ttd_kepala_nama = await bacaKepalaNama();
    return nd;
}

// ---------- helper: ambil ND milik user (untuk edit/hapus) ----------
async function loadOwned(ndId, user_key) {
    const [rows] = await db.query('SELECT * FROM nota_dinas WHERE id = ? AND user_key = ?', [ndId, user_key]);
    return rows.length ? rows[0] : null;
}

// ---------- helper: klausa batas akses daftar ND ----------
// Dipakai bersama oleh GET /, GET /stats, dan GET /:id supaya daftar dan
// detail selalu konsisten:
//   - ND MILIK SENDIRI selalu terlihat (termasuk akun berperan ganda)
//   - katim           : ND yang ditujukan kepadanya (status <> draft)
//                       (+ ND lama tanpa katim_key yang sudah diajukan)
//   - admin_arsiparis : ND yang sudah disetujui / terbit
function aksesWhere(req, alias = 'nota_dinas') {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);
    const A = alias;

    const bagian = [`${A}.user_key = ?`];
    const params = [user_key];

    if (roles.isKatim) {
        bagian.push(`(${A}.katim_key = ? AND ${A}.status <> 'draft')`);
        params.push(user_key);
        bagian.push(`(${A}.katim_key IS NULL AND ${A}.status IN ('diajukan','disetujui','dikembalikan','terbit'))`);
    }
    if (roles.isAdminArsiparis) {
        bagian.push(`${A}.status IN ('disetujui','terbit')`);
    }

    return { sql: bagian.join(' OR '), params };
}

// ---------- helper: apakah user berhak membuka ND ini? ----------
function bolehLihat(nd, req) {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);

    if (nd.user_key === user_key) return true;
    if (roles.isKatim) {
        if (nd.katim_key === user_key && nd.status !== 'draft') return true;
        if (!nd.katim_key && STATUS_TERLIHAT_KATIM.includes(nd.status)) return true;
    }
    if (roles.isAdminArsiparis && STATUS_TERLIHAT_ADMIN.includes(nd.status)) return true;
    return false;
}

// ---------- helper: validasi & normalisasi payload dari klien ----------
function bacaPayload(b) {
    const kepada = teks(b.kepada);
    const dari = teks(b.dari);
    const hal = teks(b.hal);
    const isi = teks(b.isi);
    const tanggalNd = toSqlDate(b.tanggalNd ?? b.tanggal_nd);

    if (!kepada) return { error: 'Tujuan (Yth) wajib diisi' };
    if (!dari) return { error: 'Pengirim (Dari) wajib diisi' };
    if (!hal) return { error: 'Hal/perihal wajib diisi' };
    if (!tanggalNd) return { error: 'Tanggal nota dinas wajib diisi' };
    if (!isi) return { error: 'Isi nota dinas wajib diisi' };

    return {
        nilai: {
            kepada,
            dari,
            lampiran: teks(b.lampiran, 255),
            hal,
            tanggal_nd: tanggalNd,
            tempat_terbit: teks(b.tempatTerbit, 150) || 'Palangka Raya',
            isi,
            lampiran_isi: teks(b.lampiranIsi),
            penandatangan_jabatan: teks(b.penandatanganJabatan, 255),
            penandatangan_nama: teks(b.penandatanganNama, 255),
            penandatangan_nip: teks(b.penandatanganNip, 150),
            nama_kabalai: teks(b.namaKabalai, 150),
        }
    };
}

// ============================================================
// GET / — daftar ND sesuai peran (filter status & pencarian)
// ============================================================
router.get('/', async (req, res) => {
    const { status, q } = req.query;
    const akses = aksesWhere(req, 'nd');
    const where = [`(${akses.sql})`];
    const params = [...akses.params];

    if (status && status !== 'all') {
        where.push('nd.status = ?');
        params.push(status);
    }
    if (q) {
        where.push('(nd.hal LIKE ? OR nd.nomor_nd LIKE ? OR nd.kepada LIKE ? OR nd.dari LIKE ?)');
        const s = `%${q}%`;
        params.push(s, s, s, s);
    }

    try {
        const [rows] = await db.query(
            `SELECT nd.id, nd.nomor_nd, nd.kepada, nd.dari, nd.hal, nd.lampiran,
                    nd.tanggal_nd, nd.status, nd.user_key, nd.username,
                    nd.katim_key, nd.katim_nama, nd.verifikator_nama, nd.penomor_nama,
                    nd.tgl_ajukan, nd.tgl_verifikasi, nd.tgl_penomoran,
                    nd.created_at, nd.updated_at
               FROM nota_dinas nd
              WHERE ${where.join(' AND ')}
              ORDER BY nd.id DESC`,
            params
        );
        rows.forEach((r) => { r.tanggal_nd = toSqlDate(r.tanggal_nd); });
        res.json({ success: true, data: rows, count: rows.length });
    } catch (e) {
        console.error('❌ GET /notadinas:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /stats — ringkasan jumlah untuk kartu & badge menu
// ============================================================
router.get('/stats', async (req, res) => {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);
    try {
        const akses = aksesWhere(req);
        const [rows] = await db.query(
            `SELECT status, COUNT(*) c FROM nota_dinas WHERE (${akses.sql}) GROUP BY status`,
            akses.params
        );
        const data = { draft: 0, diajukan: 0, disetujui: 0, dikembalikan: 0, terbit: 0 };
        rows.forEach((r) => { if (data[r.status] !== undefined) data[r.status] = r.c; });

        // Antrean khusus peran (badge di daftar & lonceng notifikasi).
        if (roles.isKatim) {
            const [[r]] = await db.query(
                "SELECT COUNT(*) c FROM nota_dinas WHERE status = 'diajukan' AND (katim_key = ? OR katim_key IS NULL)",
                [user_key]
            );
            data.menunggu_verifikasi = r.c;
        }
        if (roles.isAdminArsiparis) {
            const [[r]] = await db.query("SELECT COUNT(*) c FROM nota_dinas WHERE status = 'disetujui'");
            data.menunggu_penomoran = r.c;
        }

        res.json({ success: true, data });
    } catch (e) {
        console.error('❌ GET /notadinas/stats:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /:id — detail lengkap
// ============================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const nd = await getDetail(id);
        if (!nd) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });

        // Cegah IDOR: balas 404 (bukan 403) supaya keberadaan ND tidak bocor.
        if (!bolehLihat(nd, req)) {
            console.warn(`⛔ Akses ditolak: user ${getIdentity(req).username} mencoba membuka ND #${id}`);
            return res.status(404).json({
                success: false,
                message: 'Nota dinas tidak ditemukan atau bukan hak akses Anda'
            });
        }
        res.json({ success: true, data: nd });
    } catch (e) {
        console.error('❌ GET /notadinas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST / — buat ND baru (draft)
// ============================================================
router.post('/', async (req, res) => {
    const { user_key, username } = getIdentity(req);
    const baca = bacaPayload(req.body || {});
    if (baca.error) return res.status(400).json({ success: false, message: baca.error });

    // Snapshot nama Kepala Balai & penandatangan (default dari Pengaturan bila klien tidak mengirim).
    const nilai = baca.nilai;
    const kepalaNama = (await bacaKepalaNama()) || null;
    if (!nilai.nama_kabalai) nilai.nama_kabalai = kepalaNama;
    if (!nilai.penandatangan_nama) nilai.penandatangan_nama = kepalaNama;

    try {
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            const [r] = await conn.query(
                `INSERT INTO nota_dinas
                   (user_key, username, kepada, dari, lampiran, hal, tanggal_nd, tempat_terbit, isi, lampiran_isi,
                    penandatangan_jabatan, penandatangan_nama, penandatangan_nip, nama_kabalai, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`,
                [
                    user_key, username,
                    nilai.kepada, nilai.dari, nilai.lampiran, nilai.hal, nilai.tanggal_nd,
                    nilai.tempat_terbit, nilai.isi, nilai.lampiran_isi,
                    nilai.penandatangan_jabatan, nilai.penandatangan_nama,
                    nilai.penandatangan_nip, nilai.nama_kabalai,
                ]
            );
            const id = r.insertId;
            await catatLog(id, 'buat', req, 'Nota dinas dibuat', conn);
            await conn.commit();
            res.status(201).json({ success: true, message: 'Nota dinas dibuat (draft)', data: { id } });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ POST /notadinas:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// PUT /:id — perbarui ND (pemilik; status draft/dikembalikan)
// ============================================================
router.put('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    const baca = bacaPayload(req.body || {});
    if (baca.error) return res.status(400).json({ success: false, message: baca.error });

    try {
        const nd = await loadOwned(id, user_key);
        if (!nd) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(nd.status)) {
            return res.status(400).json({ success: false, message: `Tidak bisa diubah saat status "${nd.status}"` });
        }

        const nilai = baca.nilai;
        // Klien tidak mengirim namaKabalai/penandatangan → pertahankan snapshot ND,
        // atau ambil dari Pengaturan → Pejabat Penandatangan bila belum ada.
        const kepalaNama = (await bacaKepalaNama()) || null;
        const namaKabalai = nilai.nama_kabalai || nd.nama_kabalai || kepalaNama;
        const penandatanganNama = nilai.penandatangan_nama || nd.penandatangan_nama || kepalaNama;

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE nota_dinas SET
                    kepada = ?, dari = ?, lampiran = ?, hal = ?, tanggal_nd = ?,
                    tempat_terbit = ?, isi = ?, lampiran_isi = ?,
                    penandatangan_jabatan = ?, penandatangan_nama = ?, penandatangan_nip = ?,
                    nama_kabalai = ?
                 WHERE id = ? AND user_key = ?`,
                [
                    nilai.kepada, nilai.dari, nilai.lampiran, nilai.hal, nilai.tanggal_nd,
                    nilai.tempat_terbit, nilai.isi, nilai.lampiran_isi,
                    nilai.penandatangan_jabatan, penandatanganNama, nilai.penandatangan_nip,
                    namaKabalai,
                    id, user_key,
                ]
            );
            await catatLog(id, 'update', req, 'Nota dinas diperbarui', conn);
            await conn.commit();
            res.json({ success: true, message: 'Nota dinas diperbarui', data: { id: Number(id) } });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ PUT /notadinas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /:id/ajukan — user mengajukan ND ke katim
// body: { katimKey, katimNama, katimNip }
// ============================================================
router.post('/:id/ajukan', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    const { katimKey, katimNama, katimNip } = req.body || {};
    try {
        const nd = await loadOwned(id, user_key);
        if (!nd) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(nd.status)) {
            return res.status(400).json({ success: false, message: `Tidak bisa diajukan saat status "${nd.status}"` });
        }
        if (!katimKey) {
            return res.status(400).json({ success: false, message: 'Silakan pilih katim tujuan terlebih dahulu' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE nota_dinas SET status='diajukan', catatan=NULL,
                   katim_key=?, katim_nama=?, katim_nip=?, tgl_ajukan=NOW()
                 WHERE id=? AND user_key=?`,
                [katimKey, teks(katimNama, 255), teks(katimNip, 150), id, user_key]
            );
            await catatLog(id, 'ajukan', req, `Diajukan ke katim: ${katimNama || katimKey}`, conn);
            await conn.commit();
            res.json({ success: true, message: 'Nota dinas diajukan ke katim' });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ POST /notadinas/:id/ajukan:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /:id/verifikasi — katim setujui / kembalikan
// body: { keputusan: 'setujui'|'kembalikan', catatan }
// ============================================================
router.post('/:id/verifikasi', async (req, res) => {
    const roles = roleInfo(req);
    if (!roles.isKatim) {
        return res.status(403).json({ success: false, message: 'Hanya Katim yang dapat memverifikasi' });
    }

    const { id } = req.params;
    const { keputusan, catatan } = req.body || {};
    if (!['setujui', 'kembalikan'].includes(keputusan)) {
        return res.status(400).json({ success: false, message: 'keputusan harus "setujui" atau "kembalikan"' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM nota_dinas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });
        const nd = rows[0];
        if (nd.status !== 'diajukan') {
            return res.status(400).json({ success: false, message: `Hanya ND berstatus "diajukan" yang bisa diverifikasi (saat ini: ${nd.status})` });
        }
        if (nd.katim_key && nd.katim_key !== req.user.id) {
            return res.status(403).json({ success: false, message: `Nota dinas ini ditujukan ke katim lain (${nd.katim_nama || nd.katim_key})` });
        }

        const vkey = req.user.id;
        const vnama = req.user.name || req.user.username || '';
        const vnip = nomorDariUsername(req.user.username);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            if (keputusan === 'setujui') {
                await conn.query(
                    `UPDATE nota_dinas SET status='disetujui',
                       verifikator_key=?, verifikator_nama=?, verifikator_nip=?,
                       tgl_verifikasi=NOW(), catatan_verifikasi=?
                     WHERE id=?`,
                    [vkey, vnama, vnip, teks(catatan), id]
                );
                await catatLog(id, 'verifikasi', req, 'Disetujui oleh katim', conn);
                await conn.commit();
                return res.json({ success: true, message: 'Nota dinas disetujui. Menunggu penomoran admin arsiparis.' });
            }
            await conn.query(
                `UPDATE nota_dinas SET status='dikembalikan', catatan=?, catatan_verifikasi=?
                 WHERE id=?`,
                [teks(catatan) || '', teks(catatan), id]
            );
            await catatLog(id, 'kembalikan', req, catatan || 'Dikembalikan oleh katim', conn);
            await conn.commit();
            return res.json({ success: true, message: 'Nota dinas dikembalikan ke pemohon' });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ POST /notadinas/:id/verifikasi:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /:id/penomoran — admin_arsiparis membubuhkan nomor ND
// body: { nomorNd }
// ============================================================
router.post('/:id/penomoran', async (req, res) => {
    const roles = roleInfo(req);
    if (!roles.isAdminArsiparis) {
        return res.status(403).json({ success: false, message: 'Hanya Admin Arsiparis yang dapat memberi nomor' });
    }

    const { id } = req.params;
    const { nomorNd } = req.body || {};
    if (!nomorNd || !String(nomorNd).trim()) {
        return res.status(400).json({ success: false, message: 'Nomor nota dinas wajib diisi' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM nota_dinas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });
        const nd = rows[0];
        if (nd.status !== 'disetujui') {
            return res.status(400).json({ success: false, message: `Hanya ND berstatus "disetujui" yang bisa dinomori (saat ini: ${nd.status})` });
        }

        const pkey = req.user.id;
        const pnama = req.user.name || req.user.username || '';
        const pnip = nomorDariUsername(req.user.username);
        const nomorFinal = String(nomorNd).trim().slice(0, 150);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE nota_dinas SET status='terbit', nomor_nd=?, nomor_nd_manual=1,
                   penomor_key=?, penomor_nama=?, penomor_nip=?, tgl_penomoran=NOW()
                 WHERE id=?`,
                [nomorFinal, pkey, pnama, pnip, id]
            );
            await catatLog(id, 'penomoran', req, `Nomor ND: ${nomorFinal}`, conn);
            await conn.commit();
            res.json({ success: true, message: `Nomor nota dinas ${nomorFinal} berhasil diterbitkan.` });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ POST /notadinas/:id/penomoran:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// DELETE /:id — hapus ND (hanya pemilik, status draft/dikembalikan)
// ============================================================
router.delete('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    try {
        const nd = await loadOwned(id, user_key);
        if (!nd) return res.status(404).json({ success: false, message: 'Nota dinas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(nd.status)) {
            return res.status(400).json({ success: false, message: 'Hanya ND draft/dikembalikan yang bisa dihapus' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE FROM nota_dinas_log WHERE nota_dinas_id = ?', [id]);
            await conn.query('DELETE FROM nota_dinas WHERE id = ?', [id]);
            await conn.commit();
            res.json({ success: true, message: 'Nota dinas dihapus' });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ DELETE /notadinas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /pdf — render halaman cetak ND menjadi SATU berkas PDF
// Body: { html, namaFile }
// (Sama seperti /api/surattugas/pdf — dicetak di server memakai Chrome headless.)
// ============================================================
router.post('/pdf', async (req, res) => {
    const { html, namaFile } = req.body || {};

    if (!html || typeof html !== 'string') {
        return res.status(400).json({ success: false, message: 'Parameter html wajib dikirim' });
    }

    try {
        const { htmlKePdf } = require('../utils/pdfRender');
        const pdf = await htmlKePdf(html);

        const nama = String(namaFile || 'nota-dinas').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 120);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nama}.pdf"`);
        return res.send(pdf);
    } catch (e) {
        console.error('❌ POST /notadinas/pdf:', e.message);
        return res.status(500).json({ success: false, message: 'Gagal membuat PDF: ' + e.message });
    }
});

module.exports = router;
