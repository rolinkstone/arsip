// ============================================================
// Router: Notifikasi "Perlu Tindakan"
// Base URL: /api/notifikasi
//
// SENGAJA TIDAK memakai tabel notifikasi sendiri — daftar ini DIHITUNG
// langsung dari tabel surat_tugas & nota_dinas. Alasannya:
//   - tidak pernah basi: begitu ST diverifikasi / diberi nomor, notifikasinya
//     otomatis hilang (tidak ada notifikasi "hantu" yang tertinggal);
//   - tidak perlu migrasi tabel baru & tidak perlu penanda "sudah dibaca".
//
// Isi notifikasi (sama dengan aturan badge di GET /surattugas/stats dan
// GET /notadinas/stats supaya konsisten):
//   - katim           : ST/ND berstatus 'diajukan' yang ditujukan kepadanya
//                       (+ dokumen lama yang katim_key-nya NULL, sama seperti aksesWhere)
//   - admin_arsiparis : ST/ND berstatus 'disetujui' yang belum diberi nomor
//
// Role lain tidak mendapat notifikasi (daftar kosong) — bukan error.
//
// Sejak Modul Nota Dinas ada, route ini menghitung DUA sumber (surat_tugas dan
// nota_dinas). `jenis` membedakannya: 'verifikasi'/'penomoran' untuk ST,
// 'nd_verifikasi'/'nd_penomoran' untuk Nota Dinas.
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { getIdentity, roleInfo, tanggalIndo } = require('../utils/suratHelpers');

// '2026-09-10 14:05:00' -> '10 September 2026 • 14:05'
function waktuIndo(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const jam = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${tanggalIndo(d)} • ${jam}`;
}

// ============================================================
// GET / — daftar notifikasi untuk user yang sedang login
// Hasil: { success, data: { jumlah, items: [...] } }
//   item = { id, jenis: 'verifikasi'|'penomoran', judul, pesan, waktu, waktuTeks, url }
// ============================================================
router.get('/', async (req, res) => {
    const { user_key } = getIdentity(req);
    const roles = roleInfo(req);

    try {
        const items = [];

        // ---- 1. Katim: ST yang menunggu DIVERIFIKASI ----
        if (roles.isKatim) {
            const [rows] = await db.query(
                `SELECT id, nomor_st, kegiatan, username, tgl_ajukan, katim_key
                   FROM surat_tugas
                  WHERE status = 'diajukan' AND (katim_key = ? OR katim_key IS NULL)
                  ORDER BY (tgl_ajukan IS NULL), tgl_ajukan ASC, id ASC`,
                [user_key]
            );
            rows.forEach((r) => {
                items.push({
                    id: r.id,
                    jenis: 'verifikasi',
                    judul: 'ST menunggu verifikasi Anda',
                    pesan: `Diajukan oleh ${r.username || 'pengguna'} — ${r.kegiatan || '(tanpa kegiatan)'}`,
                    waktu: r.tgl_ajukan,
                    waktuTeks: waktuIndo(r.tgl_ajukan),
                    // ST lama tanpa katim_key = belum ditujukan ke siapa pun
                    catatan: r.katim_key ? '' : 'Belum ditujukan ke katim tertentu',
                    url: `/surattugas?id=${r.id}`
                });
            });
        }

        // ---- 2. Admin arsiparis: ST yang menunggu DIBERI NOMOR ST ----
        if (roles.isAdminArsiparis) {
            const [rows] = await db.query(
                `SELECT id, nomor_st, kegiatan, verifikator_nama, tgl_verifikasi
                   FROM surat_tugas
                  WHERE status = 'disetujui'
                  ORDER BY (tgl_verifikasi IS NULL), tgl_verifikasi ASC, id ASC`
            );
            rows.forEach((r) => {
                items.push({
                    id: r.id,
                    jenis: 'penomoran',
                    judul: 'ST menunggu diberi nomor ST',
                    pesan: `Disetujui ${r.verifikator_nama || 'katim'} — ${r.kegiatan || '(tanpa kegiatan)'}`,
                    waktu: r.tgl_verifikasi,
                    waktuTeks: waktuIndo(r.tgl_verifikasi),
                    catatan: '',
                    url: `/surattugas?id=${r.id}`
                });
            });
        }

        // ---- 3. Katim: NOTA DINAS yang menunggu DIVERIFIKASI ----
        if (roles.isKatim) {
            const [rows] = await db.query(
                `SELECT id, nomor_nd, hal, username, tgl_ajukan, katim_key
                   FROM nota_dinas
                  WHERE status = 'diajukan' AND (katim_key = ? OR katim_key IS NULL)
                  ORDER BY (tgl_ajukan IS NULL), tgl_ajukan ASC, id ASC`,
                [user_key]
            );
            rows.forEach((r) => {
                items.push({
                    id: r.id,
                    jenis: 'nd_verifikasi',
                    judul: 'Nota dinas menunggu verifikasi Anda',
                    pesan: `Diajukan oleh ${r.username || 'pengguna'} — ${r.hal || '(tanpa hal)'}`,
                    waktu: r.tgl_ajukan,
                    waktuTeks: waktuIndo(r.tgl_ajukan),
                    catatan: r.katim_key ? '' : 'Belum ditujukan ke katim tertentu',
                    url: `/notadinas?id=${r.id}`
                });
            });
        }

        // ---- 4. Admin arsiparis: NOTA DINAS yang menunggu DIBERI NOMOR ----
        if (roles.isAdminArsiparis) {
            const [rows] = await db.query(
                `SELECT id, nomor_nd, hal, verifikator_nama, tgl_verifikasi
                   FROM nota_dinas
                  WHERE status = 'disetujui'
                  ORDER BY (tgl_verifikasi IS NULL), tgl_verifikasi ASC, id ASC`
            );
            rows.forEach((r) => {
                items.push({
                    id: r.id,
                    jenis: 'nd_penomoran',
                    judul: 'Nota dinas menunggu diberi nomor',
                    pesan: `Disetujui ${r.verifikator_nama || 'katim'} — ${r.hal || '(tanpa hal)'}`,
                    waktu: r.tgl_verifikasi,
                    waktuTeks: waktuIndo(r.tgl_verifikasi),
                    catatan: '',
                    url: `/notadinas?id=${r.id}`
                });
            });
        }

        res.json({
            success: true,
            data: {
                jumlah: items.length,
                items,
                peran: { isKatim: roles.isKatim, isAdminArsiparis: roles.isAdminArsiparis }
            }
        });
    } catch (e) {
        console.error('❌ GET /notifikasi:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
