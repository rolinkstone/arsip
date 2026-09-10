// ============================================================
// Router: Modul Surat Tugas (ST) & SPPD
// Base URL: /api/surattugas
//
// Alur: user buat ST+SPPD (draft) → ajukan (diajukan)
//       → katim verifikasi (disetujui / dikembalikan)
//       → admin_arsiparis penomoran (terbit)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const {
    getIdentity, roleInfo, tanggalIndo, lamaHari, toSqlDate,
    logAction
} = require('../utils/suratHelpers');

const INSTANSI_DEFAULT = 'Balai Besar POM di Palangka Raya';

// ---------- helper: ambil detail lengkap ST ----------
async function getDetail(stId) {
    const [rows] = await db.query('SELECT * FROM surat_tugas WHERE id = ?', [stId]);
    if (rows.length === 0) return null;
    const st = rows[0];

    const [dasar] = await db.query(
        'SELECT id, urutan, dasar_aturan_id, isi FROM surat_tugas_dasar WHERE surat_tugas_id = ? ORDER BY urutan, id', [stId]);
    const [peserta] = await db.query(
        'SELECT * FROM surat_tugas_peserta WHERE surat_tugas_id = ? ORDER BY urutan, id', [stId]);
    const [sppd] = await db.query(
        'SELECT * FROM sppd WHERE surat_tugas_id = ? ORDER BY urutan, id', [stId]);
    const [log] = await db.query(
        'SELECT * FROM surat_tugas_log WHERE surat_tugas_id = ? ORDER BY id DESC', [stId]);

    st.dasar = dasar;
    st.peserta = peserta;
    st.sppd = sppd.map(s => ({
        ...s,
        tanggal_berangkat: toSqlDate(s.tanggal_berangkat),
        tanggal_kembali: toSqlDate(s.tanggal_kembali)
    }));
    st.log = log;
    st.rencana_tgl_mulai = toSqlDate(st.rencana_tgl_mulai);
    st.rencana_tgl_selesai = toSqlDate(st.rencana_tgl_selesai);
    st.tanggal_st = toSqlDate(st.tanggal_st);
    return st;
}

// ---------- helper: cek kepemilikan / status ----------
async function loadOwned(stId, user_key) {
    const [rows] = await db.query('SELECT * FROM surat_tugas WHERE id = ? AND user_key = ?', [stId, user_key]);
    return rows.length ? rows[0] : null;
}

function nomorDariUsername(username) {
    return username && /^\d[\d\s]*$/.test(String(username)) ? String(username).replace(/\s/g, '') : null;
}

// ============================================================
// GET / — daftar surat tugas (dibatasi role)
// ============================================================
router.get('/', async (req, res) => {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);
    const { status, q } = req.query;

    const where = [];
    const params = [];

    if (roles.isKatim) {
        // Katim hanya melihat ST yang ditujukan kepadanya (+ ST lama tanpa penugasan)
        where.push("(katim_key = ? AND status <> 'draft') OR (katim_key IS NULL AND status IN ('diajukan','disetujui','dikembalikan','terbit'))");
        params.push(user_key);
    } else if (roles.isAdminArsiparis) {
        where.push("status IN ('disetujui','terbit')");
    } else {
        where.push('user_key = ?');
        params.push(user_key);
    }

    if (status && status !== 'all') {
        where.push('status = ?');
        params.push(status);
    }
    if (q) {
        where.push('(kegiatan LIKE ? OR nomor_st LIKE ? OR mak LIKE ? OR kota_kab_kecamatan LIKE ?)');
        const s = `%${q}%`;
        params.push(s, s, s, s);
    }

    const sql = `
        SELECT st.id, st.nomor_st, st.kegiatan, st.mak, st.kota_kab_kecamatan,
               st.tanggal_st, st.status, st.tanpa_sppd, st.ppk_nama, st.tgl_verifikasi, st.tgl_penomoran,
               st.created_at, st.updated_at,
               (SELECT COUNT(*) FROM surat_tugas_peserta p WHERE p.surat_tugas_id = st.id) AS jml_peserta,
               (SELECT COUNT(*) FROM sppd s2 WHERE s2.surat_tugas_id = st.id) AS jml_sppd
        FROM surat_tugas st
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY st.id DESC`;

    try {
        const [rows] = await db.query(sql, params);
        rows.forEach(r => { r.tanggal_st = toSqlDate(r.tanggal_st); });
        res.json({ success: true, data: rows, count: rows.length });
    } catch (e) {
        console.error('❌ GET /surattugas:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /stats — ringkasan jumlah untuk badge menu
// ============================================================
router.get('/stats', async (req, res) => {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);
    try {
        let data;
        if (roles.isKatim) {
            const [[r]] = await db.query(
                "SELECT COUNT(*) c FROM surat_tugas WHERE status = 'diajukan' AND (katim_key = ? OR katim_key IS NULL)",
                [user_key]
            );
            data = { menunggu_verifikasi: r.c };
        } else if (roles.isAdminArsiparis) {
            const [[r]] = await db.query("SELECT COUNT(*) c FROM surat_tugas WHERE status = 'disetujui'");
            data = { menunggu_penomoran: r.c };
        } else {
            const [rows] = await db.query(
                "SELECT status, COUNT(*) c FROM surat_tugas WHERE user_key = ? GROUP BY status",
                [user_key]
            );
            data = { draft: 0, diajukan: 0, disetujui: 0, dikembalikan: 0, terbit: 0 };
            rows.forEach(r => { data[r.status] = r.c; });
        }
        res.json({ success: true, data });
    } catch (e) {
        console.error('❌ GET /surattugas/stats:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /dashboard — data dashboard (counts, tren 6 bulan, terbaru)
// ============================================================
router.get('/dashboard', async (req, res) => {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);
    let where = '';
    const params = [];
    if (roles.isKatim) {
        where = "(katim_key = ? OR (katim_key IS NULL AND status IN ('diajukan','disetujui','dikembalikan','terbit')))";
        params.push(user_key);
    } else if (roles.isAdminArsiparis) {
        where = "status IN ('disetujui','terbit')";
    } else {
        where = 'user_key = ?';
        params.push(user_key);
    }
    try {
        const [rows] = await db.query(
            `SELECT status, COUNT(*) c FROM surat_tugas WHERE ${where} GROUP BY status`, params);
        const counts = { draft: 0, diajukan: 0, disetujui: 0, dikembalikan: 0, terbit: 0 };
        rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status] = r.c; });

        const [recent] = await db.query(
            `SELECT id, nomor_st, kegiatan, mak, status, tanggal_st, created_at
             FROM surat_tugas WHERE ${where} ORDER BY id DESC LIMIT 6`, params);
        recent.forEach(r => { r.tanggal_st = toSqlDate(r.tanggal_st); });

        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleString('id-ID', { month: 'short' }),
                total: 0
            });
        }
        const [trows] = await db.query(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') bln, COUNT(*) c
             FROM surat_tugas WHERE ${where} AND created_at >= ? GROUP BY bln`,
            [...params, `${months[0].key}-01`]
        );
        const map = {};
        trows.forEach(r => { map[r.bln] = r.c; });
        months.forEach(m => { m.total = map[m.key] || 0; });

        res.json({ success: true, data: { counts, recent, trend: months } });
    } catch (e) {
        console.error('❌ GET /surattugas/dashboard:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// GET /:id — detail lengkap
// ============================================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const st = await getDetail(id);
        if (!st) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        res.json({ success: true, data: st });
    } catch (e) {
        console.error('❌ GET /surattugas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST / — buat ST baru (draft) + dasar + peserta + SPPD
// ============================================================
router.post('/', async (req, res) => {
    const { user_key, username } = getIdentity(req);
    const b = req.body || {};

    const peserta = Array.isArray(b.peserta) ? b.peserta : [];
    if (peserta.length === 0) {
        return res.status(400).json({ success: false, message: 'Minimal harus ada satu peserta' });
    }
    if (!b.tanggalSt) {
        return res.status(400).json({ success: false, message: 'Tanggal surat tugas wajib diisi' });
    }
    const rencanaMulai = toSqlDate(b.tglMulai);
    const rencanaSelesai = toSqlDate(b.tglSelesai);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const stRes = await conn.query(
            `INSERT INTO surat_tugas
               (user_key, username, kegiatan_id, kegiatan_sumber, kegiatan, mak,
                kota_kab_kecamatan, rencana_tgl_mulai, rencana_tgl_selesai,
                tanggal_st, tempat_terbit, untuk, menimbang_a, menimbang_b,
                ppk_id, ppk_nama, ppk_nip, ppk_manual, tanpa_sppd, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`,
            [
                user_key, username,
                b.kegiatanId || null, b.kegiatanSumber || 'talawang', b.kegiatan || null, b.mak || null,
                b.kota || null, rencanaMulai, rencanaSelesai,
                toSqlDate(b.tanggalSt), b.tempatTerbit || null, b.untuk || null,
                b.menimbangA || null, b.menimbangB || null,
                b.ppkId || null, b.ppkNama || null, b.ppkNip || null, b.ppkManual ? 1 : 0,
                b.tanpaSppd ? 1 : 0
            ]
        );
        const stId = stRes[0].insertId;

        // --- dasar yang dipilih ---
        const dasar = Array.isArray(b.dasar) ? b.dasar : [];
        for (let i = 0; i < dasar.length; i++) {
            const isi = String(dasar[i]?.isi || '').trim();
            if (isi) {
                const srcId = Number.isFinite(Number(dasar[i]?.id)) ? Number(dasar[i].id) : null;
                await conn.query(
                    'INSERT INTO surat_tugas_dasar (surat_tugas_id, urutan, dasar_aturan_id, isi) VALUES (?,?,?,?)',
                    [stId, i + 1, srcId, isi]
                );
            }
        }

        // --- peserta + SPPD (1 peserta = 1 SPPD) ---
        for (let i = 0; i < peserta.length; i++) {
            const p = peserta[i] || {};
            const instansi = p.instansi || INSTANSI_DEFAULT;

            const pr = await conn.query(
                `INSERT INTO surat_tugas_peserta
                   (surat_tugas_id, urutan, nama, nip, pangkat, jabatan, instansi, sumber)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [stId, i + 1, p.nama || null, p.nip || null,
                 p.pangkat || null, p.jabatan || null, instansi, p.sumber || 'talawang']
            );
            const pesertaId = pr[0].insertId;

            const s = (p.sppd && typeof p.sppd === 'object') ? p.sppd : {};
            const tglBerangkat = toSqlDate(s.tanggalBerangkat) || rencanaMulai;
            const tglKembali = toSqlDate(s.tanggalKembali) || rencanaSelesai;
            const lama = s.lamaPerjalanan
                || lamaHari(tglBerangkat, tglKembali)
                || lamaHari(rencanaMulai, rencanaSelesai)
                || null;

            if (!b.tanpaSppd) {
                await conn.query(
                    `INSERT INTO sppd
                       (surat_tugas_id, peserta_id, urutan, nama, nip, pangkat, jabatan, instansi,
                        tingkat_biaya, alat_angkut, tempat_berangkat, tempat_tujuan, lama_perjalanan,
                        tanggal_berangkat, tanggal_kembali, mata_anggaran, keterangan_lain,
                        ppk_id, ppk_nama, ppk_nip)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [stId, pesertaId, i + 1,
                     p.nama || null, p.nip || null, p.pangkat || null, p.jabatan || null, instansi,
                     s.tingkatBiaya || null, s.alatAngkut || null,
                     s.tempatBerangkat || null, s.tempatTujuan || b.kota || null, lama,
                     tglBerangkat, tglKembali,
                     s.mataAnggaran || b.mak || null, s.keteranganLain || null,
                     b.ppkId || null, b.ppkNama || null, b.ppkNip || null]
                );
            }
        }

        await logAction(stId, 'create', req, 'ST dibuat (draft)', conn);
        await conn.commit();
        res.json({ success: true, message: 'Surat tugas berhasil dibuat', data: { id: stId } });
    } catch (e) {
        await conn.rollback();
        console.error('❌ POST /surattugas:', e);
        res.status(500).json({ success: false, message: e.message });
    } finally {
        conn.release();
    }
});

// ============================================================
// PUT /:id — perbarui ST (hanya pemilik, status draft/dikembalikan)
// ============================================================
router.put('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    const b = req.body || {};

    try {
        const st = await loadOwned(id, user_key);
        if (!st) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(st.status)) {
            return res.status(400).json({ success: false, message: `Tidak bisa diubah saat status "${st.status}"` });
        }

        const peserta = Array.isArray(b.peserta) ? b.peserta : [];
        if (peserta.length === 0) {
            return res.status(400).json({ success: false, message: 'Minimal harus ada satu peserta' });
        }

        const tglMulaiU = toSqlDate(b.tglMulai ?? st.rencana_tgl_mulai);
        const tglSelesaiU = toSqlDate(b.tglSelesai ?? st.rencana_tgl_selesai);
        const tanggalStU = toSqlDate(b.tanggalSt ?? st.tanggal_st);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE surat_tugas SET
                    kegiatan_id = ?, kegiatan_sumber = ?, kegiatan = ?, mak = ?,
                    kota_kab_kecamatan = ?, rencana_tgl_mulai = ?, rencana_tgl_selesai = ?,
                    tanggal_st = ?, tempat_terbit = ?, untuk = ?,
                    menimbang_a = ?, menimbang_b = ?,
                    ppk_id = ?, ppk_nama = ?, ppk_nip = ?, ppk_manual = ?, tanpa_sppd = ?
                 WHERE id = ? AND user_key = ?`,
                [
                    b.kegiatanId ?? st.kegiatan_id, b.kegiatanSumber ?? st.kegiatan_sumber,
                    b.kegiatan ?? st.kegiatan, b.mak ?? st.mak,
                    b.kota ?? st.kota_kab_kecamatan, tglMulaiU,
                    tglSelesaiU,
                    tanggalStU, b.tempatTerbit ?? st.tempat_terbit, b.untuk ?? st.untuk,
                    b.menimbangA ?? st.menimbang_a, b.menimbangB ?? st.menimbang_b,
                    b.ppkId ?? st.ppk_id, b.ppkNama ?? st.ppk_nama, b.ppkNip ?? st.ppk_nip,
                    b.ppkManual !== undefined ? (b.ppkManual ? 1 : 0) : st.ppk_manual,
                    b.tanpaSppd !== undefined ? (b.tanpaSppd ? 1 : 0) : st.tanpa_sppd,
                    id, user_key
                ]
            );

            // ganti child: dasar / peserta / sppd
            await conn.query('DELETE FROM surat_tugas_dasar WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM sppd WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM surat_tugas_peserta WHERE surat_tugas_id = ?', [id]);

            const tanpaSppdU = b.tanpaSppd !== undefined ? !!b.tanpaSppd : !!st.tanpa_sppd;

            const dasar = Array.isArray(b.dasar) ? b.dasar : [];
            for (let i = 0; i < dasar.length; i++) {
                const isi = String(dasar[i]?.isi || '').trim();
                if (isi) {
                    const srcId = Number.isFinite(Number(dasar[i]?.id)) ? Number(dasar[i].id) : null;
                    await conn.query(
                        'INSERT INTO surat_tugas_dasar (surat_tugas_id, urutan, dasar_aturan_id, isi) VALUES (?,?,?,?)',
                        [id, i + 1, srcId, isi]
                    );
                }
            }

            for (let i = 0; i < peserta.length; i++) {
                const p = peserta[i] || {};
                const instansi = p.instansi || INSTANSI_DEFAULT;

                const pr = await conn.query(
                    `INSERT INTO surat_tugas_peserta
                       (surat_tugas_id, urutan, nama, nip, pangkat, jabatan, instansi, sumber)
                     VALUES (?,?,?,?,?,?,?,?)`,
                    [id, i + 1, p.nama || null, p.nip || null,
                     p.pangkat || null, p.jabatan || null, instansi, p.sumber || 'talawang']
                );
                const pesertaId = pr[0].insertId;

                const s = (p.sppd && typeof p.sppd === 'object') ? p.sppd : {};
                const tglBerangkat = toSqlDate(s.tanggalBerangkat) || tglMulaiU;
                const tglKembali = toSqlDate(s.tanggalKembali) || tglSelesaiU;
                const lama = s.lamaPerjalanan
                    || lamaHari(tglBerangkat, tglKembali)
                    || lamaHari(tglMulaiU, tglSelesaiU)
                    || null;

                if (!tanpaSppdU) {
                    await conn.query(
                        `INSERT INTO sppd
                           (surat_tugas_id, peserta_id, urutan, nama, nip, pangkat, jabatan, instansi,
                            tingkat_biaya, alat_angkut, tempat_berangkat, tempat_tujuan, lama_perjalanan,
                            tanggal_berangkat, tanggal_kembali, mata_anggaran, keterangan_lain,
                            ppk_id, ppk_nama, ppk_nip)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [id, pesertaId, i + 1,
                         p.nama || null, p.nip || null, p.pangkat || null, p.jabatan || null, instansi,
                         s.tingkatBiaya || null, s.alatAngkut || null,
                         s.tempatBerangkat || null, s.tempatTujuan || b.kota || null, lama,
                         tglBerangkat, tglKembali,
                         s.mataAnggaran || b.mak || null, s.keteranganLain || null,
                         b.ppkId ?? st.ppk_id, b.ppkNama ?? st.ppk_nama, b.ppkNip ?? st.ppk_nip]
                    );
                }
            }

            await logAction(id, 'update', req, 'ST diperbarui', conn);
            await conn.commit();
            res.json({ success: true, message: 'Surat tugas diperbarui', data: { id: Number(id) } });
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error('❌ PUT /surattugas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /:id/ajukan — user mengajukan ke katim
// ============================================================
router.post('/:id/ajukan', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    const { katimKey, katimNama, katimNip } = req.body || {};
    try {
        const st = await loadOwned(id, user_key);
        if (!st) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(st.status)) {
            return res.status(400).json({ success: false, message: `Tidak bisa diajukan saat status "${st.status}"` });
        }
        if (!katimKey) {
            return res.status(400).json({ success: false, message: 'Silakan pilih katim tujuan terlebih dahulu' });
        }
        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `UPDATE surat_tugas SET status='diajukan', catatan=NULL,
                   katim_key=?, katim_nama=?, katim_nip=?, tgl_ajukan=NOW()
                 WHERE id=? AND user_key=?`,
                [katimKey, katimNama || null, katimNip || null, id, user_key]
            );
            await logAction(id, 'ajukan', req, `Diajukan ke katim: ${katimNama || katimKey}`, conn);
            await conn.commit();
            res.json({ success: true, message: 'Surat tugas diajukan ke katim' });
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }
    } catch (e) {
        console.error('❌ POST /surattugas/:id/ajukan:', e);
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
        const [rows] = await db.query('SELECT * FROM surat_tugas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        const st = rows[0];
        if (st.status !== 'diajukan') {
            return res.status(400).json({ success: false, message: `Hanya ST berstatus "diajukan" yang bisa diverifikasi (saat ini: ${st.status})` });
        }
        if (st.katim_key && st.katim_key !== req.user.id) {
            return res.status(403).json({ success: false, message: `Surat tugas ini ditujukan ke katim lain (${st.katim_nama || st.katim_key})` });
        }

        const vkey = req.user.id;
        const vnama = req.user.name || req.user.username || '';
        const vnip = nomorDariUsername(req.user.username);

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            if (keputusan === 'setujui') {
                await conn.query(
                    `UPDATE surat_tugas SET status='disetujui',
                       verifikator_key=?, verifikator_nama=?, verifikator_nip=?,
                       tgl_verifikasi=NOW(), catatan_verifikasi=?
                     WHERE id=?`,
                    [vkey, vnama, vnip, catatan || null, id]
                );
                await logAction(id, 'verifikasi', req, 'Disetujui oleh katim', conn);
                res.json({ success: true, message: 'ST disetujui. Menunggu penomoran admin arsiparis.' });
            } else {
                await conn.query(
                    `UPDATE surat_tugas SET status='dikembalikan', catatan=?, catatan_verifikasi=?
                     WHERE id=?`,
                    [catatan || '', catatan || null, id]
                );
                await logAction(id, 'kembalikan', req, catatan || 'Dikembalikan oleh katim', conn);
                res.json({ success: true, message: 'ST dikembalikan ke pemohon' });
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }
    } catch (e) {
        console.error('❌ POST /surattugas/:id/verifikasi:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST /:id/penomoran — admin_arsiparis membubuhkan nomor ST
// body: { nomorSt, sppdNumbers?: { [sppdId]: 'nomor' } }
// ============================================================
router.post('/:id/penomoran', async (req, res) => {
    const roles = roleInfo(req);
    if (!roles.isAdminArsiparis) {
        return res.status(403).json({ success: false, message: 'Hanya Admin Arsiparis yang dapat memberi nomor' });
    }

    const { id } = req.params;
    const { nomorSt, sppdNumbers } = req.body || {};
    if (!nomorSt || !String(nomorSt).trim()) {
        return res.status(400).json({ success: false, message: 'Nomor surat tugas wajib diisi' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM surat_tugas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        const st = rows[0];
        if (st.status !== 'disetujui') {
            return res.status(400).json({ success: false, message: `Hanya ST berstatus "disetujui" yang bisa dinomori (saat ini: ${st.status})` });
        }

        const pkey = req.user.id;
        const pnama = req.user.name || req.user.username || '';
        const pnip = nomorDariUsername(req.user.username);
        const nomorStFinal = String(nomorSt).trim();
        const tglStText = tanggalIndo(st.tanggal_st); // mis. 20 Januari 2026

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(
                `UPDATE surat_tugas SET nomor_st=?, status='terbit',
                   penomor_key=?, penomor_nama=?, penomor_nip=?, tgl_penomoran=NOW()
                 WHERE id=?`,
                [nomorStFinal, pkey, pnama, pnip, id]
            );

            const [sppdRows] = await conn.query(
                'SELECT id, urutan FROM sppd WHERE surat_tugas_id = ? ORDER BY urutan, id', [id]);

            for (const s of sppdRows) {
                let noSppd = null;
                if (sppdNumbers && sppdNumbers[s.id]) {
                    noSppd = String(sppdNumbers[s.id]).trim();
                } else {
                    noSppd = String(s.urutan); // default: 1, 2, 3 ... (format penuh bisa diedit)
                }
                const keterangan = `Surat Tugas Nomor ${nomorStFinal} tanggal ${tglStText}`;
                await conn.query(
                    'UPDATE sppd SET nomor_sppd=?, keterangan_lain=? WHERE id=?',
                    [noSppd, keterangan, s.id]
                );
            }

            await logAction(id, 'penomoran', req, `Nomor ST: ${nomorStFinal}`, conn);
            await conn.commit();
            res.json({ success: true, message: 'Nomor ST & SPPD berhasil diterbitkan' });
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }
    } catch (e) {
        console.error('❌ POST /surattugas/:id/penomoran:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// PUT /:id/sppd/:sppdId — admin perbaiki nomor/isi SPPD (terbit/disetujui)
// ============================================================
router.put('/:id/sppd/:sppdId', async (req, res) => {
    const roles = roleInfo(req);
    if (!roles.isAdminArsiparis && !roles.isUser) {
        return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    const { id, sppdId } = req.params;
    const { nomorSppd } = req.body || {};

    try {
        const [rows] = await db.query('SELECT * FROM surat_tugas WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'ST tidak ditemukan' });

        const st = rows[0];
        // hanya admin yang boleh ubah nomor_sppd setelah terbit
        if (nomorSppd !== undefined && !roles.isAdminArsiparis) {
            return res.status(403).json({ success: false, message: 'Hanya Admin Arsiparis yang dapat mengubah nomor SPPD' });
        }
        if (!['disetujui', 'terbit'].includes(st.status)) {
            return res.status(400).json({ success: false, message: `Status "${st.status}" tidak mengizinkan perubahan nomor SPPD` });
        }

        await db.query('UPDATE sppd SET nomor_sppd = ? WHERE id = ? AND surat_tugas_id = ?',
            [nomorSppd ? String(nomorSppd).trim() : null, sppdId, id]);
        res.json({ success: true, message: 'Nomor SPPD diperbarui' });
    } catch (e) {
        console.error('❌ PUT /surattugas/:id/sppd/:sppdId:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// DELETE /:id — hapus ST (hanya pemilik, status draft/dikembalikan)
// ============================================================
router.delete('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const { id } = req.params;
    try {
        const st = await loadOwned(id, user_key);
        if (!st) return res.status(404).json({ success: false, message: 'Surat tugas tidak ditemukan' });
        if (!['draft', 'dikembalikan'].includes(st.status)) {
            return res.status(400).json({ success: false, message: 'Hanya ST draft/dikembalikan yang bisa dihapus' });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('DELETE FROM surat_tugas_log WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM surat_tugas_dasar WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM sppd WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM surat_tugas_peserta WHERE surat_tugas_id = ?', [id]);
            await conn.query('DELETE FROM surat_tugas WHERE id = ?', [id]);
            await conn.commit();
            res.json({ success: true, message: 'Surat tugas dihapus' });
        } catch (e) {
            await conn.rollback(); throw e;
        } finally { conn.release(); }
    } catch (e) {
        console.error('❌ DELETE /surattugas/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
