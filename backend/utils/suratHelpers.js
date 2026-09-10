// ============================================================
// Helper bersama Modul Surat Tugas & SPPD
// ============================================================

// --- Identitas & role dari req.user (di-set authMiddleware server.js) ---
function getIdentity(req) {
    return {
        user_key: req.user?.id || null,            // Keycloak sub
        username: req.user?.username || req.user?.name || ''
    };
}

function roleInfo(req) {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    return {
        isUser: roles.includes('user'),
        isKatim: roles.includes('katim'),
        isAdminArsiparis: roles.includes('admin_arsiparis'),
        roles
    };
}

// --- Nama bulan Indonesia ---
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// 'YYYY-MM-DD' | Date -> '20 Januari 2026'
function tanggalIndo(dateStr) {
    if (!dateStr) return '';
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr + (String(dateStr).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// 'YYYY-MM-DD' | Date -> '20/01/2026'
function tanggalSlash(dateStr) {
    if (!dateStr) return '';
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr + (String(dateStr).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Lama perjalanan (hari) antara dua tanggal, inklusif -> '6 Hari'
function lamaHari(from, to) {
    if (!from || !to) return '';
    const a = new Date(from + 'T00:00:00');
    const b = new Date(to + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return '';
    const ms = Math.abs(b.getTime() - a.getTime());
    const hari = Math.round(ms / 86400000) + 1;
    return `${hari} Hari`;
}

// NIP tanpa spasi
function normalizeNip(nip) {
    return String(nip || '').replace(/\s/g, '');
}

// Normalisasi nilai tanggal (Date / ISO string / 'YYYY-MM-DD') menjadi 'YYYY-MM-DD' lokal,
// atau null bila kosong/tidak valid. Mencegah error "Incorrect date value" pada kolom DATE.
function toSqlDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Catat log workflow
async function logAction(suratTugasId, aksi, req, catatan = '', conn = null) {
    const { user_key, username } = getIdentity(req);
    const q = 'INSERT INTO surat_tugas_log (surat_tugas_id, aksi, user_key, username, catatan) VALUES (?,?,?,?,?)';
    const params = [suratTugasId, aksi, user_key, username, catatan];
    if (conn) {
        await conn.query(q, params);
    } else {
        const db = require('../db');
        await db.query(q, params);
    }
}

// Nama variabel helper (untuk menghindari typo antar file)
const CONST = {
    STATUS: ['draft', 'diajukan', 'disetujui', 'dikembalikan', 'terbit']
};

module.exports = {
    getIdentity,
    roleInfo,
    tanggalIndo,
    tanggalSlash,
    lamaHari,
    normalizeNip,
    toSqlDate,
    logAction,
    CONST
};
