-- ============================================================
-- Migrasi 006: dasar_aturan mendukung jenis (menimbang/dasar) & aturan GLOBAL
--
-- Konsep:
--   - is_global = 1 → aturan dikelola role admin_arsiparis, tampil utk SEMUA user
--       jenis 'menimbang' → paragraf Menimbang (a, b) — tampil otomatis di ST (read-only)
--       jenis 'dasar'     → daftar dasar master yang bisa dipilih semua user
--   - is_global = 0 → dasar PRIBADI milik user (tambahan di luar aturan admin)
--
-- Jalankan:
--   mysql -h 127.0.0.1 -P 3306 -u root bpom_arsip_surat < data/schema/006_dasar_aturan_jenis_global.sql
-- ============================================================

USE bpom_arsip_surat;

-- ------------------------------------------------------------------
-- 1) Tambah kolom jenis & is_global pada dasar_aturan
-- ------------------------------------------------------------------
ALTER TABLE dasar_aturan
    ADD COLUMN jenis ENUM('dasar','menimbang') NOT NULL DEFAULT 'dasar'
        COMMENT 'jenis aturan: dasar (pilihan user) | menimbang (otomatis)'
        AFTER username,
    ADD COLUMN is_global TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = dikelola admin_arsiparis & tampil untuk semua user'
        AFTER is_active,
    ADD KEY idx_da_jenis_global (jenis, is_global, is_active);

-- ------------------------------------------------------------------
-- 2) SEED — Menimbang (global, dikelola admin_arsiparis)
-- ------------------------------------------------------------------
INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'menimbang', 1,
       'Bahwa dalam rangka untuk menunjang pelaksanaan tugas dan fungsi Balai Besar POM di Palangka Raya sebagai Unit Pelaksana Teknis di Lingkungan Badan POM;',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'menimbang' AND urutan = 1);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'menimbang', 2,
       'Bahwa untuk memenuhi maksud pada butir a di atas, ditunjuk pegawai Balai Besar POM di Palangka Raya untuk mengikuti kegiatan tersebut.',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'menimbang' AND urutan = 2);

-- ------------------------------------------------------------------
-- 3) SEED — Dasar (global, dikelola admin_arsiparis)
-- ------------------------------------------------------------------
INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 1,
       'Peraturan Badan Pengawas Obat dan Makanan Nomor 1 Tahun 2026 tentang Perubahan Kedua Atas Peraturan Badan Pengawas Obat dan Makanan Nomor 19 Tahun 2023 tentang Organisasi dan Tata Kerja Unit Pelaksana Teknis Pada Badan Pengawas Obat dan Makanan',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 1);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 2,
       'Peraturan Badan Pengawas Obat dan Makanan Nomor 20 Tahun 2025 tentang Standar Cara Distribusi Obat Yang Baik',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 2);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 3,
       'Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 3);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 4,
       'Peraturan Badan Pengawas Obat dan Makanan Nomor 18 Tahun 2025 tentang Pengawasan Produk Tembakau dan Rokok Elektronik;',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 4);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 5,
       'Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen (Lembaran Negara Republik Indonesia Tahun 1999 Nomor 42, Tambahan Lembaran Negara Republik Indonesia Nomor 3821);',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 5);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 6,
       'Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan (Lembaran Negara Republik Indonesia Tahun 2023 Nomor 105, Tambahan Lembaran Negara Republik Indonesia Nomor 6887);',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 6);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 7,
       'Undang-Undang Nomor 1 Tahun 2023 tentang Kitab Undang-Undang Hukum Pidana (Lembaran Negara Republik Indonesia Tahun 2023 Nomor 1, Tambahan Lembaran Negara Republik Indonesia Nomor 6842);',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 7);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 8,
       'Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan (Lembaran Negara Republik Indonesia Tahun 2023 Nomor 105, Tambahan Lembaran Negara Republik Indonesia Nomor 6887);',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 8);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 9,
       'Undang-Undang Nomor 20 Tahun 2025 tentang Kitab Undang-Undang Hukum Acara Pidana (Lembaran Negara Republik Indonesia Tahun 2025 Nomor 188, Tambahan Lembaran Negara Republik Indonesia Nomor 7149)',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 9);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 10,
       'Peraturan Presiden Nomor 80 Tahun 2017 tentang Badan Pengawas Obat dan Makanan sebagaimana telah diubah dengan Peraturan Presiden Nomor 25 Tahun 2023;',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 10);

INSERT INTO dasar_aturan (user_key, username, jenis, urutan, isi, is_global)
SELECT 'ADMIN_GLOBAL', 'Admin', 'dasar', 11,
       'Undang-Undang Nomor 18 Tahun 2012 tentang Pangan',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM dasar_aturan WHERE jenis = 'dasar' AND is_global = 1 AND urutan = 11);
