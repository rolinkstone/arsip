-- ============================================================
-- Migrasi 007: Surat Tugas bisa TANPA SPPD
--   tanpa_sppd = 1  -> ST ini tidak membuat SPPD (tidak ada perjalanan dinas)
--   tanpa_sppd = 0  -> default, ST dengan SPPD (1 peserta = 1 SPPD)
-- Jalankan:
--   mysql -h 127.0.0.1 -P 3306 -u root bpom_arsip_surat < data/schema/007_surat_tugas_tanpa_sppd.sql
-- ============================================================

USE bpom_arsip_surat;

ALTER TABLE surat_tugas
    ADD COLUMN tanpa_sppd TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = ST tanpa SPPD (tidak membuat SPPD)'
        AFTER ppk_manual;
