// ============================================================
// Router: Dasar Aturan (Pengaturan) — Menimbang & Dasar
// Base URL: /api/dasaraturan
//
// Model (sejak migrasi 006):
//   • Aturan GLOBAL (is_global = 1) — dikelola role admin_arsiparis,
//     tampil untuk SEMUA user:
//       - jenis 'menimbang' → paragraf Menimbang (a, b) — tampil otomatis
//                              & read-only di Surat Tugas
//       - jenis 'dasar'     → daftar dasar master yang bisa DIPILIH user
//   • Aturan PRIBADI (is_global = 0, user_key = pemilik) — dasar tambahan
//     milik masing-masing user, dipilih bersama aturan global admin.
//
// Aturan akses:
//   - Melihat  : semua user boleh (global + dasar pribadi miliknya)
//   - Menambah/Mengubah/Menghapus:
//       * aturan global & menimbang → hanya admin_arsiparis
//       * dasar pribadi             → hanya pemiliknya
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db');
const { getIdentity, roleInfo } = require('../utils/suratHelpers');

const JENIS = ['dasar', 'menimbang'];
const MAX_MENIMBANG = 2; // Menimbang selalu dua paragraf (a & b)

// role yang boleh mengelola aturan global / menimbang
const isAdminGlobal = (req) => roleInfo(req).isAdminArsiparis;

// ============================================================
// GET / — daftar aturan yang terlihat oleh user login
// Query:
//   jenis=dasar | menimbang  (opsional; default: keduanya)
//   semua=1                  (sertakan yang is_active = 0)
// ============================================================
router.get('/', async (req, res) => {
    const { user_key } = getIdentity(req);
    const admin = isAdminGlobal(req);
    const { jenis, semua } = req.query;

    let where;
    const params = [];

    if (jenis === 'menimbang') {
        where = "jenis = 'menimbang' AND is_global = 1";
    } else if (jenis === 'dasar') {
        where = "jenis = 'dasar' AND (is_global = 1 OR user_key = ?)";
        params.push(user_key);
    } else {
        where = "((is_global = 1 AND jenis IN ('dasar','menimbang')) OR (jenis = 'dasar' AND user_key = ?))";
        params.push(user_key);
    }

    if (semua !== '1') {
        where += ' AND is_active = 1';
    }

    try {
        const [rows] = await db.query(
            `SELECT id, jenis, urutan, isi, is_global, is_active, username, updated_at
             FROM dasar_aturan
             WHERE ${where}
             ORDER BY jenis ASC, is_global DESC, urutan ASC, id ASC`,
            params
        );
        res.json({ success: true, data: rows, isAdmin: admin });
    } catch (e) {
        console.error('❌ GET /dasaraturan:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// POST / — tambah aturan
// Body: { isi, jenis?, urutan?, is_global? }
//   menimbang            → wajib admin_arsiparis, otomatis global
//   dasar + is_global    → wajib admin_arsiparis
//   dasar (tanpa global) → milik user yang login
// ============================================================
router.post('/', async (req, res) => {
    const { user_key, username } = getIdentity(req);
    const admin = isAdminGlobal(req);
    const { isi, jenis, urutan, is_global } = req.body || {};

    if (!isi || !String(isi).trim()) {
        return res.status(400).json({ success: false, message: 'Isi aturan wajib diisi' });
    }

    const jns = JENIS.includes(jenis) ? jenis : 'dasar';
    let global = false;

    if (jns === 'menimbang') {
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Menimbang hanya bisa dikelola Admin (Arsiparis)' });
        }
        global = true;
    } else if (is_global) {
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Aturan global hanya bisa dikelola Admin (Arsiparis)' });
        }
        global = true;
    }

    try {
        // Batasi jumlah paragraf Menimbang (selalu a & b)
        if (jns === 'menimbang') {
            const [[c]] = await db.query(
                "SELECT COUNT(*) AS c FROM dasar_aturan WHERE jenis = 'menimbang' AND is_global = 1"
            );
            if (Number(c.c) >= MAX_MENIMBANG) {
                return res.status(400).json({
                    success: false,
                    message: `Menimbang maksimal ${MAX_MENIMBANG} paragraf (a & b). Gunakan menu edit.`
                });
            }
        }

        let noUrut = urutan;
        if (noUrut === undefined || noUrut === null) {
            let sql = 'SELECT COALESCE(MAX(urutan),0) + 1 AS next FROM dasar_aturan WHERE jenis = ?';
            const args = [jns];
            if (global) {
                sql += ' AND is_global = 1';
            } else {
                sql += ' AND is_global = 0 AND user_key = ?';
                args.push(user_key);
            }
            const [[row]] = await db.query(sql, args);
            noUrut = row ? row.next : 1;
        }

        const [result] = await db.query(
            `INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
             VALUES (?,?,?,?,?,?)`,
            [user_key, username, jns, Number(noUrut) || 1, String(isi).trim(), global ? 1 : 0]
        );
        res.json({ success: true, message: 'Aturan disimpan', data: { id: result.insertId, jenis: jns, is_global: global ? 1 : 0 } });
    } catch (e) {
        console.error('❌ POST /dasaraturan:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// PUT /:id — ubah aturan
//  - global / menimbang  → hanya admin_arsiparis
//  - dasar pribadi       → hanya pemilik
// Body: { isi?, urutan?, is_active? }
// ============================================================
router.put('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const admin = isAdminGlobal(req);
    const { id } = req.params;
    const { isi, urutan, is_active } = req.body || {};

    try {
        const [rows] = await db.query('SELECT * FROM dasar_aturan WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Aturan tidak ditemukan' });
        }
        const row = rows[0];

        if (row.is_global) {
            if (!admin) {
                return res.status(403).json({ success: false, message: 'Aturan global hanya bisa diubah oleh Admin (Arsiparis)' });
            }
        } else if (String(row.user_key) !== String(user_key)) {
            return res.status(404).json({ success: false, message: 'Aturan tidak ditemukan' });
        }

        const fields = [];
        const params = [];
        if (isi !== undefined) { fields.push('isi = ?'); params.push(String(isi).trim()); }
        if (urutan !== undefined) { fields.push('urutan = ?'); params.push(Number(urutan)); }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });
        }

        params.push(id);
        await db.query(`UPDATE dasar_aturan SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: 'Aturan diperbarui' });
    } catch (e) {
        console.error('❌ PUT /dasaraturan/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ============================================================
// DELETE /:id — hapus aturan (otorisasi sama seperti PUT)
// ============================================================
router.delete('/:id', async (req, res) => {
    const { user_key } = getIdentity(req);
    const admin = isAdminGlobal(req);
    const { id } = req.params;

    try {
        const [rows] = await db.query('SELECT * FROM dasar_aturan WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Aturan tidak ditemukan' });
        }
        const row = rows[0];

        if (row.is_global) {
            if (!admin) {
                return res.status(403).json({ success: false, message: 'Aturan global hanya bisa dihapus oleh Admin (Arsiparis)' });
            }
        } else if (String(row.user_key) !== String(user_key)) {
            return res.status(404).json({ success: false, message: 'Aturan tidak ditemukan' });
        }

        const [result] = await db.query('DELETE FROM dasar_aturan WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Aturan tidak ditemukan' });
        }
        res.json({ success: true, message: 'Aturan dihapus' });
    } catch (e) {
        console.error('❌ DELETE /dasaraturan/:id:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
