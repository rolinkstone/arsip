-- ============================================================
-- Migration Glassware v2: Barang masuk & Pecah menjadi transaksi
-- yang BISA LEBIH DARI 1 KALI per item per periode
-- (menyamakan pola "Barang Masuk" ATK/Reagen)
--
-- 1. Buat tabel transaksi: glassware_masuk & glassware_pecah
-- 2. Migrasi data lama (stok_opname_glassware.tanggal_masuk/jumlah_masuk
--    & tanggal_pecah/jumlah_pecah) -> transaksi pertama (bila > 0)
-- 3. Kolom lama di stok_opname_glassware tetap ada (deprecated) supaya
--    seed migration_glassware.sql lama tetap bisa jalan.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS `glassware_masuk` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `periode_id`      INT UNSIGNED NOT NULL,
  `laboratorium_id` INT UNSIGNED NOT NULL,
  `glassware_id`    INT UNSIGNED NOT NULL,
  `tanggal`         DATE         NOT NULL,
  `jumlah`          INT          NOT NULL DEFAULT 0,
  `keterangan`      TEXT         DEFAULT NULL,
  `created_by`      VARCHAR(100) DEFAULT NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_masuk_periode_lab_item` (`periode_id`,`laboratorium_id`,`glassware_id`),
  KEY `fk_masuk_periode` (`periode_id`),
  KEY `fk_masuk_lab`     (`laboratorium_id`),
  KEY `fk_masuk_item`    (`glassware_id`),
  CONSTRAINT `fk_masuk_periode` FOREIGN KEY (`periode_id`)      REFERENCES `periode_stok_opname` (`id`),
  CONSTRAINT `fk_masuk_lab`     FOREIGN KEY (`laboratorium_id`) REFERENCES `laboratorium` (`id`),
  CONSTRAINT `fk_masuk_item`    FOREIGN KEY (`glassware_id`)    REFERENCES `master_glassware` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `glassware_pecah` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `periode_id`      INT UNSIGNED NOT NULL,
  `laboratorium_id` INT UNSIGNED NOT NULL,
  `glassware_id`    INT UNSIGNED NOT NULL,
  `tanggal`         DATE         NOT NULL,
  `jumlah`          INT          NOT NULL DEFAULT 0,
  `keterangan`      TEXT         DEFAULT NULL,
  `created_by`      VARCHAR(100) DEFAULT NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pecah_periode_lab_item` (`periode_id`,`laboratorium_id`,`glassware_id`),
  KEY `fk_pecah_periode` (`periode_id`),
  KEY `fk_pecah_lab`     (`laboratorium_id`),
  KEY `fk_pecah_item`    (`glassware_id`),
  CONSTRAINT `fk_pecah_periode` FOREIGN KEY (`periode_id`)      REFERENCES `periode_stok_opname` (`id`),
  CONSTRAINT `fk_pecah_lab`     FOREIGN KEY (`laboratorium_id`) REFERENCES `laboratorium` (`id`),
  CONSTRAINT `fk_pecah_item`    FOREIGN KEY (`glassware_id`)    REFERENCES `master_glassware` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- MIGRASI DATA LAMA (guard: hanya bila tabel stok punya data transaksi lama)
-- ============================================================
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stok_opname_glassware' AND COLUMN_NAME = 'jumlah_masuk'
);

SET @sql := IF(@has_col > 0,
  'INSERT INTO glassware_masuk (periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan, created_by)
   SELECT periode_id, laboratorium_id, glassware_id, tanggal_masuk, jumlah_masuk, keterangan, ''migrasi-excel''
   FROM stok_opname_glassware
   WHERE jumlah_masuk IS NOT NULL AND jumlah_masuk > 0 AND tanggal_masuk IS NOT NULL',
  'SELECT ''skip migrasi masuk (kolom lama tidak ada)''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@has_col > 0,
  'INSERT INTO glassware_pecah (periode_id, laboratorium_id, glassware_id, tanggal, jumlah, keterangan, created_by)
   SELECT periode_id, laboratorium_id, glassware_id, tanggal_pecah, jumlah_pecah, keterangan, ''migrasi-excel''
   FROM stok_opname_glassware
   WHERE jumlah_pecah IS NOT NULL AND jumlah_pecah > 0 AND tanggal_pecah IS NOT NULL',
  'SELECT ''skip migrasi pecah (kolom lama tidak ada)''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
