-- ============================================================
-- Migrasi 011: MODUL NOTA DINAS
--
-- Database: surat_bbpompky
--   (sejak 2026-09-21 nama database di LOCAL dan PRODUCTION sama —
--    lihat catatan pada 010_index_kinerja_query.sql)
--
-- Modul Nota Dinas (ND) mengikuti ALUR yang SAMA dengan Surat Tugas:
--   draft -> diajukan -> (katim) disetujui / dikembalikan
--                     -> (admin_arsiparis) penomoran = terbit
--
-- Perbedaan dengan surat_tugas:
--   - ND memakai format surat (kop + NOTA DINAS + nomor + Yth/Dari/
--     Lampiran/Hal/Tanggal + isi bebas + tanda tangan), BUKAN tabel peserta.
--   - Isi ND disimpan sebagai teks di kolom `isi`; baris kosong dipakai
--     sebagai pemisah paragraf (spasi antar paragraf 1,15).
--   - Nomor ND diisi MANUAL oleh admin_arsiparis (format resmi, mis.
--     "KA.04.01.16A.04.24.20") — tidak ada penomoran berurutan otomatis.
--
-- Jalankan:
--   mysql -h 127.0.0.1 -P 3306 -u root surat_bbpompky < data/schema/011_modul_nota_dinas.sql
--
-- File ini idempotent (CREATE TABLE IF NOT EXISTS) — aman dijalankan berulang.
--
-- CATATAN: `lampiran_isi` (isi halaman lampiran) ditambahkan belakangan.
--   - Instalasi BARU: cukup file ini (kolom sudah termasuk di bawah).
--   - Database yang SUDAH menjalankan versi awal file ini: jalankan juga
--     `012_nota_dinas_lampiran.sql`.
-- ============================================================

USE surat_bbpompky;

-- ------------------------------------------------------------------
-- 1) NOTA DINAS (header/dokumen)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nota_dinas (
    id            INT AUTO_INCREMENT PRIMARY KEY,

    -- Identitas pembuat
    user_key      VARCHAR(255) NOT NULL COMMENT 'Keycloak sub pembuat',
    username      VARCHAR(150) NULL,

    -- Isi surat
    kepada        TEXT NULL COMMENT 'Yth — tujuan nota dinas',
    dari          TEXT NULL COMMENT 'Dari — unit/jabatan pengirim',
    lampiran      VARCHAR(255) NULL COMMENT 'Lampiran (mis. "-" atau jumlah berkas) — baris pada badan surat',
    hal           TEXT NULL COMMENT 'Hal/perihal',
    tanggal_nd    DATE NULL COMMENT 'tanggal nota dinas',
    tempat_terbit VARCHAR(150) DEFAULT 'Palangka Raya',
    isi           TEXT NULL COMMENT 'isi nota dinas; baris kosong = pemisah paragraf',
    lampiran_isi  TEXT NULL COMMENT 'isi halaman lampiran (lembar tersendiri); tiap baris = satu paragraf',

    -- Penandatangan (nama yang tercetak di bawah placeholder ttd Srikandi)
    penandatangan_jabatan VARCHAR(255) NULL,
    penandatangan_nama    VARCHAR(255) NULL,
    penandatangan_nip     VARCHAR(150) NULL,
    nama_kabalai          VARCHAR(150) NULL COMMENT 'snapshot nama Kepala Balai saat ND dibuat',

    -- Penomoran (diisi admin_arsiparis)
    nomor_nd      VARCHAR(150) NULL COMMENT 'nomor ND penuh (format resmi)',
    nomor_nd_manual TINYINT(1) NOT NULL DEFAULT 0,

    -- Workflow
    -- status: draft | diajukan | disetujui | dikembalikan | terbit
    status        VARCHAR(30) NOT NULL DEFAULT 'draft',
    catatan       TEXT NULL COMMENT 'catatan umum (alasan pengembalian dsb.)',

    -- Data pengajuan ke katim
    katim_key     VARCHAR(255) NULL,
    katim_nama    VARCHAR(255) NULL,
    katim_nip     VARCHAR(150) NULL,
    tgl_ajukan    DATETIME NULL,

    -- Data verifikasi katim
    verifikator_key   VARCHAR(255) NULL,
    verifikator_nama  VARCHAR(255) NULL,
    verifikator_nip   VARCHAR(150) NULL,
    tgl_verifikasi    DATETIME NULL,
    catatan_verifikasi TEXT NULL,

    -- Data penomoran admin_arsiparis
    penomor_key   VARCHAR(255) NULL,
    penomor_nama  VARCHAR(255) NULL,
    penomor_nip   VARCHAR(150) NULL,
    tgl_penomoran DATETIME NULL,

    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_nd_user_status (user_key, status),
    KEY idx_nd_status (status),
    KEY idx_nd_katim (katim_key, status),
    KEY idx_nd_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 2) NOTA DINAS LOG — jejak langkah workflow (ajukan/verifikasi/penomoran)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nota_dinas_log (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nota_dinas_id INT NOT NULL,
    aksi          VARCHAR(50) NOT NULL,
    user_key      VARCHAR(255) NULL,
    username      VARCHAR(150) NULL,
    catatan       TEXT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ndl_nd (nota_dinas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
