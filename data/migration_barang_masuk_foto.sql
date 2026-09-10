-- ============================================================
-- Migration: Kolom foto_url utk Barang Masuk (ATK & Reagen)
-- Menyimpan URL foto barang yang diupload bersamaan dengan nota/kuitansi.
-- Jalankan: mysql -h 127.0.0.1 -u root pemeliharaan_aset_bpom < data/migration_barang_masuk_foto.sql
-- (idempotent — aman dijalankan ulang)
-- ============================================================

-- barang_masuk (Persediaan ATK)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'barang_masuk'
    AND COLUMN_NAME = 'foto_url'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE barang_masuk ADD COLUMN foto_url VARCHAR(500) DEFAULT NULL AFTER kuitansi_url',
  'SELECT ''barang_masuk.foto_url sudah ada''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- reagen_masuk (Reagen)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reagen_masuk'
    AND COLUMN_NAME = 'foto_url'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE reagen_masuk ADD COLUMN foto_url VARCHAR(500) DEFAULT NULL AFTER kuitansi_url',
  'SELECT ''reagen_masuk.foto_url sudah ada''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
