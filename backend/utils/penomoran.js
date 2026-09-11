// ============================================================
// utils/penomoran.js — Penomoran SPPD OTOMATIS (urut per TAHUN)
// ============================================================
// Nomor SPPD = angka urut murni (1, 2, 3, …) yang terus naik dalam satu
// tahun, lalu RESET ke 1 saat tahun berganti.
//
// Titik lanjut urutan disimpan di tabel app_setting (key-value), SATU KUNCI
// PER TAHUN:
//     nomor_sppd_terakhir_<tahun> = nomor TERAKHIR yang sudah dipakai tahun itu
// mis. nomor_sppd_terakhir_2026 = '335'
//
// Kenapa per tahun (bukan satu angka global)?
//   Supaya menomori dokumen tahun lain TIDAK mereset/merusak hitungan tahun
//   berjalan. Tahun yang belum pernah dipakai otomatis mulai dari 1.
//
// Admin arsiparis menyetel "nomor terakhir" lewat
// Pengaturan → Penomoran Manual (routes/penomoran.js).
//
// PENTING (anti-nomor-kembar): alokasiNomorSppd WAJIB dipanggil di dalam
// transaksi dan memakai SELECT ... FOR UPDATE, sehingga dua admin yang
// menerbitkan nomor bersamaan tidak mungkin mendapat nomor yang sama.
// ============================================================
const db = require('../db');

const PREFIX_KUNCI = 'nomor_sppd_terakhir_';
const keteranganKunci = (tahun) => `Nomor SPPD terakhir yang sudah dipakai tahun ${tahun}`;

const kunciTahun = (tahun) => `${PREFIX_KUNCI}${tahun}`;

// ---------- util kecil ----------
function keInt(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}

/** Tahun periode penomoran diambil dari tanggal Surat Tugas (fallback: tahun ini). */
function tahunDokumen(tanggalSt) {
    if (tanggalSt) {
        const s = String(tanggalSt);
        const d = tanggalSt instanceof Date ? tanggalSt : new Date(s.length === 10 ? `${s}T00:00:00` : s);
        if (!Number.isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
}

/** Buat baris setting tahun tsb bila belum ada (supaya SELECT FOR UPDATE benar-benar mengunci). */
async function pastikanBarisAda(conn, tahun) {
    await conn.query(
        'INSERT IGNORE INTO app_setting (setting_key, setting_value, keterangan) VALUES (?,?,?)',
        [kunciTahun(tahun), '0', keteranganKunci(tahun)]
    );
}

/** Update dulu, insert bila belum ada — portabel (tanpa VALUES() yang usang). */
async function simpanSatu(conn, tahun, nilai) {
    const kunci = kunciTahun(tahun);
    const [r] = await conn.query(
        'UPDATE app_setting SET setting_value = ?, keterangan = ? WHERE setting_key = ?',
        [String(nilai), keteranganKunci(tahun), kunci]
    );
    if (r.affectedRows === 0) {
        await conn.query(
            'INSERT INTO app_setting (setting_key, setting_value, keterangan) VALUES (?,?,?)',
            [kunci, String(nilai), keteranganKunci(tahun)]
        );
    }
}

/** Baca nomor terakhir untuk satu tahun (0 bila belum pernah dipakai). */
async function bacaSetting(tahun, conn = db) {
    const t = keInt(tahun) || new Date().getFullYear();
    const [rows] = await conn.query(
        'SELECT setting_value FROM app_setting WHERE setting_key = ?',
        [kunciTahun(t)]
    );
    const terakhir = keInt(rows[0]?.setting_value);
    return { tahun: t, terakhir: terakhir && terakhir > 0 ? terakhir : 0 };
}

/**
 * Setel manual "nomor terakhir" untuk satu tahun — dipakai halaman Pengaturan.
 * @returns {Promise<{tahun:number, terakhir:number}>}
 */
async function simpanSetting({ tahun, terakhir }, conn = db) {
    const t = keInt(tahun);
    const n = keInt(terakhir);
    if (t === null || t < 2000 || t > 2100) throw new Error('Tahun tidak valid (2000–2100)');
    if (n === null || n < 0) throw new Error('Nomor terakhir tidak valid (minimal 0)');

    await pastikanBarisAda(conn, t);
    await simpanSatu(conn, t, n);
    return { tahun: t, terakhir: n };
}

/**
 * Nomor yang AKAN dipakai (tanpa memakannya) — untuk pratinjau di UI.
 * @returns {Promise<{tahun:number, nomor:number[]}>}
 */
async function pratinjauNomorSppd({ tahun, jumlah }, conn = db) {
    const t = keInt(tahun) || new Date().getFullYear();
    const n = Math.max(1, keInt(jumlah) || 1);
    const { terakhir } = await bacaSetting(t, conn);
    return { tahun: t, nomor: Array.from({ length: n }, (_, i) => terakhir + i + 1) };
}

/**
 * Ambil `jumlah` nomor SPPD berurutan untuk `tahun`, lalu simpan posisinya.
 * WAJIB dipanggil di dalam transaksi (`conn`) — baris setting dikunci FOR UPDATE.
 * @returns {Promise<{tahun:number, nomor:number[], terakhir:number}>}
 */
async function alokasiNomorSppd({ tahun, jumlah }, conn) {
    if (!conn) throw new Error('alokasiNomorSppd butuh koneksi transaksi');
    const n = keInt(jumlah);
    const t = keInt(tahun) || tahunDokumen();
    if (!n || n < 1) return { tahun: t, nomor: [], terakhir: 0 };

    await pastikanBarisAda(conn, t);
    const [rows] = await conn.query(
        'SELECT setting_value FROM app_setting WHERE setting_key = ? FOR UPDATE',
        [kunciTahun(t)]
    );
    const terakhir = keInt(rows[0]?.setting_value) || 0;

    const nomor = Array.from({ length: n }, (_, i) => terakhir + i + 1);
    const terakhirBaru = terakhir + n;
    await simpanSatu(conn, t, terakhirBaru);

    return { tahun: t, nomor, terakhir: terakhirBaru };
}

module.exports = {
    PREFIX_KUNCI,
    kunciTahun,
    tahunDokumen,
    bacaSetting,
    simpanSetting,
    pratinjauNomorSppd,
    alokasiNomorSppd,
};
