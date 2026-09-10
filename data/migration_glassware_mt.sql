-- ============================================================
-- Migration Glassware v3: Pengajuan Semester ke MT
--
-- Alur baru:
--   1. pic_lab (dan role pencatat lain) mencatat transaksi
--      barang masuk / glassware pecah selama satu periode
--      (satu periode_stok_opname = satu semester).
--   2. Di akhir semester, pic_lab "mengirim" catatan periode+lab
--      ke seorang MT (user ber-role "mt" yang dipilih).
--   3. MT menyetujui (status 'disetujui') atau menolak
--      dengan alasan (status 'ditolak' -> pic_lab perbaiki lalu
--      kirim ulang).
--   4. Saat status 'menunggu_mt' / 'disetujui', catatan transaksi
--      periode+lab TERKUNCI (tidak bisa tambah/hapus).
--
-- Satu periode + satu laboratorium = SATU pengajuan (UNIQUE).
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS `glassware_pengajuan_mt` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `periode_id`      INT UNSIGNED NOT NULL,
  `laboratorium_id` INT UNSIGNED NOT NULL,
  `status`          ENUM('draft','menunggu_mt','disetujui','ditolak') NOT NULL DEFAULT 'draft',
  `catatan`         VARCHAR(500)  DEFAULT NULL,
  `mt_id`           VARCHAR(100)  DEFAULT NULL,
  `mt_nama`         VARCHAR(150)  DEFAULT NULL,
  `diajukan_by`     VARCHAR(100)  DEFAULT NULL,
  `diajukan_at`     DATETIME      DEFAULT NULL,
  `disetujui_by`    VARCHAR(100)  DEFAULT NULL,
  `disetujui_at`    DATETIME      DEFAULT NULL,
  `ditolak_by`      VARCHAR(100)  DEFAULT NULL,
  `ditolak_at`      DATETIME      DEFAULT NULL,
  `catatan_tolak`   TEXT          DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pengajuan_periode_lab` (`periode_id`,`laboratorium_id`),
  KEY `fk_pengajuan_periode` (`periode_id`),
  KEY `fk_pengajuan_lab`     (`laboratorium_id`),
  CONSTRAINT `fk_pengajuan_periode` FOREIGN KEY (`periode_id`)      REFERENCES `periode_stok_opname` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pengajuan_lab`     FOREIGN KEY (`laboratorium_id`) REFERENCES `laboratorium` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
