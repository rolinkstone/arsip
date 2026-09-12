// ============================================================
// utils/pengaturan.js — Setting aplikasi (tabel app_setting)
// ============================================================
// Tabel `app_setting` adalah penyimpanan KEY-VALUE sederhana:
//     setting_key | setting_value | keterangan
//
// Yang disimpan di sini (per 2026-09-12):
//   - ttd_kepala_nama → NAMA KEPALA BALAI (pejabat yang menandatangani
//     Surat Tugas, halaman lampiran, dan SPD/SPPD).
//     Dulu nama ini di-HARDCODE di komponen cetak (konstanta
//     TTD_KEPALA_NAMA di CetakSuratTugas.js & CetakSPD.js), sehingga
//     setiap ganti pimpinan harus ubah kode. Sekarang diatur lewat
//     Pengaturan → Pejabat Penandatangan.
//
// Kenapa TIDAK disimpan sebagai snapshot di tiap ST?
//   Supaya cetak dokumen lama pun ikut memakai nama pejabat yang
//   TERBARU. Cukup ubah sekali di pengaturan, seluruh cetak (ST,
//   lampiran, SPD) langsung berubah.
//
// Dipakai juga oleh routes/penomoran.js lewat kunci per tahun
// (nomor_sppd_terakhir_<tahun>) — helper di bawah bersifat umum.
// ============================================================
const db = require('../db');

const KUNCI_KEPALA_NAMA = 'ttd_kepala_nama';
const KETERANGAN_KEPALA_NAMA =
    'Nama Kepala Balai yang tercetak pada Surat Tugas, Lampiran, dan SPD';

// Batas panjang agar teks tetap 1 baris pada kolom tanda tangan cetak.
// (kolom ttd lebar konten 165,9mm; 150 karakter masih aman, 60 karakter lebih aman lagi)
const MAKS_PANJANG_NAMA = 150;

/** Baca satu setting berdasarkan kunci (null bila belum ada). */
async function bacaSetting(kunci, conn = db) {
    const [rows] = await conn.query(
        'SELECT setting_value FROM app_setting WHERE setting_key = ? LIMIT 1',
        [kunci]
    );
    if (!rows.length) return null;
    const v = rows[0].setting_value;
    return v === null || v === undefined ? null : String(v);
}

/**
 * Simpan satu setting (update dulu, insert bila belum ada).
 * Pola UPDATE → INSERT dipakai supaya portabel (tanpa `ON DUPLICATE KEY`,
 * konsisten dengan utils/penomoran.js).
 */
async function simpanSetting(kunci, nilai, keterangan = null, conn = db) {
    const [r] = await conn.query(
        'UPDATE app_setting SET setting_value = ?, keterangan = ? WHERE setting_key = ?',
        [nilai, keterangan, kunci]
    );
    if (r.affectedRows === 0) {
        await conn.query(
            'INSERT INTO app_setting (setting_key, setting_value, keterangan) VALUES (?,?,?)',
            [kunci, nilai, keterangan]
        );
    }
    return nilai;
}

// ---------------- Nama Kepala Balai ----------------

/**
 * Nama Kepala Balai yang berlaku sekarang ('' bila belum pernah diatur).
 * Dipakai routes/pejabat.js DAN routes/surattugas.js (detail ST) supaya
 * halaman cetak selalu menerima nama terbaru.
 */
async function bacaKepalaNama(conn = db) {
    const nilai = await bacaSetting(KUNCI_KEPALA_NAMA, conn);
    return (nilai || '').trim();
}

/**
 * Simpan nama Kepala Balai.
 * @throws {Error} pesan berawalan "tidak valid" → ditangkap route sebagai 400.
 */
async function simpanKepalaNama(nama, conn = db) {
    const bersih = String(nama ?? '').replace(/\s+/g, ' ').trim();

    if (!bersih) throw new Error('Nama Kepala Balai tidak valid: wajib diisi');
    if (bersih.length > MAKS_PANJANG_NAMA) {
        throw new Error(`Nama Kepala Balai tidak valid: maksimal ${MAKS_PANJANG_NAMA} karakter`);
    }
    if (/[\r\n]/.test(String(nama ?? ''))) {
        throw new Error('Nama Kepala Balai tidak valid: tidak boleh berisi baris baru');
    }

    await simpanSetting(KUNCI_KEPALA_NAMA, bersih, KETERANGAN_KEPALA_NAMA, conn);
    return bersih;
}

module.exports = {
    KUNCI_KEPALA_NAMA,
    KETERANGAN_KEPALA_NAMA,
    MAKS_PANJANG_NAMA,
    bacaSetting,
    simpanSetting,
    bacaKepalaNama,
    simpanKepalaNama,
};
