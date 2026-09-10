-- ============================================================
-- Migrasi 005: Simpan referensi dasar_aturan pada surat_tugas_dasar
-- (agar centang "Dasar" tetap tercentang saat draft diedit ulang)
-- ============================================================

USE bpom_arsip_surat;

ALTER TABLE surat_tugas_dasar
    ADD COLUMN dasar_aturan_id INT NULL COMMENT 'referensi dasar_aturan.id (sumber)';
