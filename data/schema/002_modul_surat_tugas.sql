-- ============================================================
-- ECIPAR POM — Persuratan (Arsip Surat)
-- Database: bpom_arsip_surat
-- Migrasi 002: Modul Surat Tugas (ST) & SPPD  (v1)
--
-- Alur: user membuat ST+SPPD → verifikasi katim → penomoran admin_arsiparis
--
-- Jalankan:
--   mysql -h 127.0.0.1 -P 3306 -u root bpom_arsip_surat < data/schema/002_modul_surat_tugas.sql
-- ============================================================

USE bpom_arsip_surat;

-- ------------------------------------------------------------------
-- 1) SETTING APLIKASI (key-value)
--    Menyimpan default: instansi, template "Menimbang", kode satker, dsb.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_setting (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    keterangan    VARCHAR(255) NULL,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 2) DASAR ATURAN — daftar "Dasar" milik TIAP pegawai (diisi di Pengaturan)
--    user_key = Keycloak sub dari pegawai pemilik
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dasar_aturan (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_key    VARCHAR(255) NOT NULL COMMENT 'Keycloak sub pemilik',
    username    VARCHAR(150) NULL,
    urutan      INT NOT NULL DEFAULT 0,
    isi         TEXT NOT NULL COMMENT 'Teks dasar (mis. Peraturan/DIPA/Undangan)',
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dasar_user (user_key, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 3) SURAT TUGAS (header ST)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surat_tugas (
    id            INT AUTO_INCREMENT PRIMARY KEY,

    -- Identitas pembuat
    user_key      VARCHAR(255) NOT NULL COMMENT 'Keycloak sub pembuat',
    username      VARCHAR(150) NULL,

    -- Snapshot sumber kegiatan dari talawang (DB accounting)
    kegiatan_id   INT NULL COMMENT 'referensi nominatif_kegiatan.id (accounting)',
    kegiatan_sumber VARCHAR(30) DEFAULT 'talawang',
    kegiatan      TEXT NULL COMMENT 'nama kegiatan / maksud',
    mak           VARCHAR(100) NULL COMMENT 'mata anggaran',
    kota_kab_kecamatan VARCHAR(255) NULL,
    rencana_tgl_mulai   DATE NULL,
    rencana_tgl_selesai DATE NULL,

    -- Data surat tugas
    tanggal_st    DATE NULL COMMENT 'tanggal ST (manual)',
    tempat_terbit VARCHAR(150) DEFAULT 'Palangka Raya',
    untuk         TEXT NULL COMMENT 'isi bagian Untuk (mengikuti kegiatan...)',
    menimbang_a   TEXT NULL COMMENT 'snapshot template menimbang a',
    menimbang_b   TEXT NULL COMMENT 'snapshot template menimbang b',

    -- PPK (auto dari kegiatan, bisa diganti manual)
    ppk_id        VARCHAR(100) NULL,
    ppk_nama      VARCHAR(255) NULL,
    ppk_nip       VARCHAR(150) NULL,
    ppk_manual    TINYINT(1) NOT NULL DEFAULT 0,

    -- Penomoran (diisi admin_arsiparis)
    nomor_st      VARCHAR(150) NULL COMMENT 'nomor ST penuh (format resmi)',
    nomor_st_manual TINYINT(1) NOT NULL DEFAULT 0,

    -- Workflow
    -- status: draft | diajukan | disetujui | dikembalikan | terbit
    status        VARCHAR(30) NOT NULL DEFAULT 'draft',
    catatan       TEXT NULL COMMENT 'catatan umum (alasan pengembalian dsb)',

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

    KEY idx_st_user_status (user_key, status),
    KEY idx_st_kegiatan (kegiatan_id),
    KEY idx_st_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 4) SURAT TUGAS DASAR — dasar yang DIPILIH untuk sebuah ST (child)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surat_tugas_dasar (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    surat_tugas_id  INT NOT NULL,
    urutan          INT NOT NULL DEFAULT 0,
    isi             TEXT NOT NULL,
    KEY idx_std_st (surat_tugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 5) SURAT TUGAS PESERTA — daftar pegawai pada ST (child)
--    Setiap peserta = 1 SPPD. Auto dari nominatif talawang / Keycloak.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surat_tugas_peserta (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    surat_tugas_id INT NOT NULL,
    urutan         INT NOT NULL DEFAULT 0,
    nama           VARCHAR(255) NULL,
    nip            VARCHAR(50) NULL COMMENT 'NIP (bisa berformat spasi)',
    pangkat        VARCHAR(150) NULL COMMENT 'Pangkat/Golongan (gabungan), mis. "Pembina / IV a"',
    jabatan        VARCHAR(255) NULL,
    instansi       VARCHAR(255) DEFAULT 'Balai Besar POM di Palangka Raya',
    sumber         VARCHAR(20) DEFAULT 'talawang' COMMENT 'talawang | keycloak | manual',
    KEY idx_stp_st (surat_tugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 6) SPPD — satu per peserta (child surat_tugas)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sppd (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    surat_tugas_id INT NOT NULL,
    peserta_id     INT NULL COMMENT 'referensi surat_tugas_peserta.id',
    urutan         INT NOT NULL DEFAULT 0 COMMENT '1..n dalam satu ST (dasar no sppd auto)',

    -- Snapshot data pegawai
    nama           VARCHAR(255) NULL,
    nip            VARCHAR(50) NULL,
    pangkat        VARCHAR(150) NULL COMMENT 'Pangkat/Golongan (gabungan)',
    jabatan        VARCHAR(255) NULL,
    instansi       VARCHAR(255) NULL,

    -- Isian khusus SPPD
    nomor_sppd     VARCHAR(150) NULL COMMENT 'nomor SPPD penuh (auto/editable saat penomoran)',
    tingkat_biaya  VARCHAR(5) NULL COMMENT 'A | B | C',
    alat_angkut    VARCHAR(20) NULL COMMENT 'udara | darat',
    tempat_berangkat VARCHAR(255) NULL,
    tempat_tujuan  VARCHAR(255) NULL,
    lama_perjalanan   VARCHAR(100) NULL,
    tanggal_berangkat DATE NULL,
    tanggal_kembali   DATE NULL,
    mata_anggaran  VARCHAR(150) NULL,
    keterangan_lain   TEXT NULL,

    -- PPK snapshot
    ppk_id         VARCHAR(100) NULL,
    ppk_nama       VARCHAR(255) NULL,
    ppk_nip        VARCHAR(150) NULL,

    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_sppd_st (surat_tugas_id),
    KEY idx_sppd_peserta (peserta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------
-- 7) LOG WORKFLOW (riwayat aksi: buat/ajukan/verifikasi/kembali/terbit)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surat_tugas_log (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    surat_tugas_id INT NOT NULL,
    aksi           VARCHAR(50) NOT NULL COMMENT 'create|ajukan|verifikasi|kembalikan|penomoran|update',
    user_key       VARCHAR(255) NULL,
    username       VARCHAR(150) NULL,
    catatan        TEXT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_stl_st (surat_tugas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DEFAULT SETTING
-- ============================================================
INSERT IGNORE INTO app_setting (setting_key, setting_value, keterangan) VALUES
('instansi', 'Balai Besar POM di Palangka Raya', 'Nama instansi pada kop surat'),
('tempat_terbit', 'Palangka Raya', 'Kota penerbitan ST/SPPD'),
('menimbang_a', 'Bahwa dalam rangka untuk menunjang pelaksanaan tugas dan fungsi Balai Besar POM di Palangka Raya sebagai Unit Pelaksana Teknis di Lingkungan Badan POM;', 'Template paragraf Menimbang (a)'),
('menimbang_b', 'Bahwa untuk memenuhi maksud pada butir a di atas, ditunjuk pegawai Balai Besar POM di Palangka Raya untuk mengikuti kegiatan tersebut.', 'Template paragraf Menimbang (b)');
