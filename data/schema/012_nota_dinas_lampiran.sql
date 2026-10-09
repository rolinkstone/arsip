-- ============================================================
-- Migrasi 012: NOTA DINAS — ISI HALAMAN LAMPIRAN
--
-- Database: surat_bbpompky
--
-- Menambah kolom `nota_dinas.lampiran_isi` (TEXT): isi HALAMAN LAMPIRAN
-- (lembar terpisah di belakang Nota Dinas), mis. narasi/daftar yang
-- disampaikan bersama nota dinas.
--
-- Bedanya dengan kolom `lampiran` yang sudah ada:
--   - `lampiran`     → teks SINGKAT pada baris "Lampiran : …" di badan surat
--                      (mis. "-" atau "1 berkas").
--   - `lampiran_isi` → ISI halaman lampiran; dicetak sebagai lembar tersendiri
--                      dengan kepala "Lampiran / Nota Dinas … / Nomor / Tanggal"
--                      dan blok tanda tangan. Tiap baris = satu paragraf.
--
-- Migrasi 011 (modul Nota Dinas) sudah memuat kolom ini untuk instalasi BARU.
-- File ini untuk database yang SUDAH menjalankan 011 sebelum kolom ini ada.
--
-- Jalankan (phpMyAdmin / HeidiSQL):
--   pilih database surat_bbpompky, buka tab SQL, tempel SELURUH isi file ini,
--   lalu Go. Semua pernyataan berdiri sendiri (tanpa DELIMITER / stored
--   procedure). Aman dijalankan berulang.
-- ============================================================

USE surat_bbpompky;

-- ------------------------------------------------------------------
-- 0) CEK KEADAAN SEKARANG (hanya membaca)
--      kolom_lampiran_isi = 0  -> kolom belum ada
-- ------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM nota_dinas) AS baris_nota_dinas,
    (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'nota_dinas'
        AND column_name = 'lampiran_isi') AS kolom_lampiran_isi;

-- ------------------------------------------------------------------
-- 1) Tambah kolom `lampiran_isi` HANYA bila belum ada
-- ------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'nota_dinas'
                AND column_name = 'lampiran_isi');
SET @ddl := IF(@ada > 0, 'DO 0',
  'ALTER TABLE nota_dinas ADD COLUMN lampiran_isi TEXT NULL COMMENT ''isi halaman lampiran (tiap baris = satu paragraf)'' AFTER isi');
PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;

-- ------------------------------------------------------------------
-- 2) VERIFIKASI HASIL (hanya membaca) — kolom harus muncul 1x
-- ------------------------------------------------------------------
SELECT column_name, column_type, is_nullable, column_comment
  FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'nota_dinas'
   AND column_name IN ('isi', 'lampiran', 'lampiran_isi')
 ORDER BY ordinal_position;
