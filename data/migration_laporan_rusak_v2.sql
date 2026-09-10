-- =====================================================================
-- MIGRASI ALUR LAPORAN RUSAK BMN v2 (2026-09-01)
-- Alur baru: diajukan -> (cek fisik PIC) -> internal = selesai
--            -> menunggu_katim -> menunggu_ppk -> dalam_perbaikan
--            -> menunggu_konfirmasi_kabag -> menunggu_konfirmasi_user -> selesai
-- =====================================================================

USE pemeliharaan_aset_bpom;

-- 1. Arsipkan laporan lama yang masih berjalan (status lamanya masih valid di enum lama).
--    Laporan yang sudah selesai/ditolak tetap dipertahankan.
UPDATE laporan_rusak
  SET status = 'ditolak'
  WHERE status NOT IN ('selesai', 'ditolak');

-- 2. Ubah ENUM status ke set status baru
ALTER TABLE laporan_rusak
  MODIFY COLUMN status ENUM(
    'diajukan',
    'menunggu_katim',
    'menunggu_ppk',
    'dalam_perbaikan',
    'menunggu_konfirmasi_kabag',
    'menunggu_konfirmasi_user',
    'selesai',
    'ditolak'
  ) NOT NULL DEFAULT 'diajukan';

-- 3. Tambahkan kolom pelacak alur baru
ALTER TABLE laporan_rusak
  ADD COLUMN verified_by VARCHAR(100) DEFAULT NULL AFTER status,
  ADD COLUMN verified_at DATETIME DEFAULT NULL AFTER verified_by,
  ADD COLUMN verified_catatan TEXT DEFAULT NULL AFTER verified_at,
  ADD COLUMN katim_id VARCHAR(100) DEFAULT NULL AFTER verified_catatan,
  ADD COLUMN katim_nama VARCHAR(255) DEFAULT NULL AFTER katim_id,
  ADD COLUMN katim_confirm_by VARCHAR(100) DEFAULT NULL AFTER katim_nama,
  ADD COLUMN katim_confirm_at DATETIME DEFAULT NULL AFTER katim_confirm_by,
  ADD COLUMN ppk_id VARCHAR(100) DEFAULT NULL AFTER katim_confirm_at,
  ADD COLUMN ppk_nama VARCHAR(255) DEFAULT NULL AFTER ppk_id,
  ADD COLUMN ppk_confirm_by VARCHAR(100) DEFAULT NULL AFTER ppk_nama,
  ADD COLUMN ppk_confirm_at DATETIME DEFAULT NULL AFTER ppk_confirm_by,
  ADD COLUMN kisaran_biaya TEXT DEFAULT NULL AFTER ppk_confirm_at,
  ADD COLUMN perbaikan_done_by VARCHAR(100) DEFAULT NULL AFTER kisaran_biaya,
  ADD COLUMN perbaikan_done_at DATETIME DEFAULT NULL AFTER perbaikan_done_by,
  ADD COLUMN kabag_confirm_by VARCHAR(100) DEFAULT NULL AFTER perbaikan_done_at,
  ADD COLUMN kabag_confirm_at DATETIME DEFAULT NULL AFTER kabag_confirm_by,
  ADD COLUMN user_confirm_by VARCHAR(100) DEFAULT NULL AFTER kabag_confirm_at,
  ADD COLUMN user_confirm_at DATETIME DEFAULT NULL AFTER user_confirm_by;

-- 4. Tambahkan kolom catatan pada detail_perbaikan (dipakai saat mencatat perbaikan selesai)
ALTER TABLE detail_perbaikan
  ADD COLUMN catatan TEXT DEFAULT NULL AFTER no_kontrak;
