-- ============================================================
-- Migrasi 004: Penugasan katim (kirim ke katim tertentu)
-- Kolom katim_* = katim yang DITUJU saat pengajuan (diisi user,
--   diambil dari Keycloak). Verifikasi hanya oleh katim tersebut.
-- tgl_ajukan = waktu pengajuan terakhir.
-- ============================================================

USE bpom_arsip_surat;

ALTER TABLE surat_tugas
    ADD COLUMN katim_key  VARCHAR(255) NULL COMMENT 'Keycloak sub katim tujuan',
    ADD COLUMN katim_nama VARCHAR(255) NULL,
    ADD COLUMN katim_nip  VARCHAR(150) NULL,
    ADD COLUMN tgl_ajukan DATETIME NULL;
