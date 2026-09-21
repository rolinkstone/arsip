-- ============================================================
-- Migrasi 010: INDEX UNTUK KINERJA QUERY
--
-- Database: surat_bbpompky
--   Sejak 2026-09-21 nama database di LOCAL dan PRODUCTION sama
--   (sebelumnya di local bernama bpom_arsip_surat).
--
-- Tiga index hasil audit rencana eksekusi (EXPLAIN) pada data berskala
-- (20.000 ST / 100.000 peserta / 100.000 SPPD):
--
--   1) surat_tugas_peserta.nip_bersih + idx_stp_nip_bersih
--        Pencarian "ST yang memuat saya sebagai peserta" memakai
--        REPLACE(nip,' ','') — tidak bisa memakai index. Akibatnya klausa
--        akses di routes/surattugas.js memaksa MySQL memindai SELURUH
--        surat_tugas dan mengevaluasi ulang subquery itu tiap baris.
--        Kolom generated STORED ini menyimpan NIP tanpa spasi; nilainya
--        dihitung otomatis dari kolom `nip`, tidak ada kode yang mengisinya.
--   2) surat_tugas.idx_st_created
--        Dashboard tren 6 bulan (`created_at >= ?`): full scan 19.790 baris
--        + tabel sementara -> range scan (rows=1).
--   3) surat_tugas.idx_st_katim_status (katim_key, status)
--        Antrean verifikasi katim: 4.000 baris -> 883 baris.
--
-- FILE INI MENGECEK SENDIRI: setiap index/kolom dibuat HANYA bila belum ada,
--   jadi aman dijalankan berulang — tidak akan kena
--   "Duplicate column name" / "Duplicate key name".
--   Tidak perlu sunting apa pun: jalankan apa adanya.
--
-- CATATAN SEBELUM MENJALANKAN (database besar)
--   - BACKUP dulu:
--       mysqldump -h 127.0.0.1 -u root -p surat_bbpompky > backup_surat_bbpompky.sql
--   - `ADD COLUMN ... STORED` MENYALIN SELURUH TABEL (setara ALGORITHM=COPY):
--     tabel terkunci untuk tulis selama proses. Lihat jumlah baris di bagian 0.
--   - Bagian 0 dan 4 hanya membaca, tidak mengubah apa pun.
--
-- Jalankan (CLI):
--   mysql -h 127.0.0.1 -P 3306 -u root -p surat_bbpompky < data/schema/010_index_kinerja_query.sql
--
-- Jalankan (phpMyAdmin / HeidiSQL):
--   pilih database surat_bbpompky, buka tab SQL, tempel SELURUH isi file ini
--   dari bagian 0 sampai bagian 5, lalu Go. Semua pernyataan berdiri sendiri
--   (tanpa DELIMITER / stored procedure), jadi tidak ada yang perlu dipecah.
-- ============================================================

USE surat_bbpompky;

-- ------------------------------------------------------------------
-- 0) CEK KEADAAN SEKARANG (hanya membaca, tidak mengubah)
--      kolom_nip_bersih = 0            -> nip_bersih belum ada
--      index bernilai NULL             -> index belum ada
--    Bagian 1-3 di bawah tetap aman dijalankan apa pun hasilnya.
-- ------------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM surat_tugas_peserta) AS baris_peserta,
    (SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'surat_tugas_peserta'
        AND column_name = 'nip_bersih') AS kolom_nip_bersih,
    (SELECT index_name FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'surat_tugas_peserta'
        AND index_name = 'idx_stp_nip_bersih' LIMIT 1) AS idx_stp_nip_bersih,
    (SELECT index_name FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'surat_tugas'
        AND index_name = 'idx_st_created' LIMIT 1) AS idx_st_created,
    (SELECT index_name FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'surat_tugas'
        AND index_name = 'idx_st_katim_status' LIMIT 1) AS idx_st_katim_status;

-- ------------------------------------------------------------------
-- 1) NIP tanpa spasi + index untuk pencarian peserta
--    Kolom dan index dipisah: kolomnya mungkin sudah ada dari
--    penerapan sebelumnya, sedangkan index-nya belum.
-- ------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'surat_tugas_peserta'
                AND column_name = 'nip_bersih');
SET @ddl := IF(@ada > 0, 'DO 0',
  'ALTER TABLE surat_tugas_peserta ADD COLUMN nip_bersih VARCHAR(50) GENERATED ALWAYS AS (REPLACE(nip, '' '', '''')) STORED COMMENT ''NIP tanpa spasi (generated) - dipakai pencarian peserta'' AFTER nip');
PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;

SET @ada := (SELECT COUNT(*) FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = 'surat_tugas_peserta'
                AND index_name = 'idx_stp_nip_bersih');
SET @ddl := IF(@ada > 0, 'DO 0',
  'ALTER TABLE surat_tugas_peserta ADD INDEX idx_stp_nip_bersih (nip_bersih, surat_tugas_id)');
PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;

-- ------------------------------------------------------------------
-- 2) Tren dashboard per bulan
-- ------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = 'surat_tugas'
                AND index_name = 'idx_st_created');
SET @ddl := IF(@ada > 0, 'DO 0',
  'ALTER TABLE surat_tugas ADD INDEX idx_st_created (created_at)');
PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;

-- ------------------------------------------------------------------
-- 3) Antrean verifikasi katim
-- ------------------------------------------------------------------
SET @ada := (SELECT COUNT(*) FROM information_schema.statistics
              WHERE table_schema = DATABASE() AND table_name = 'surat_tugas'
                AND index_name = 'idx_st_katim_status');
SET @ddl := IF(@ada > 0, 'DO 0',
  'ALTER TABLE surat_tugas ADD INDEX idx_st_katim_status (katim_key, status)');
PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;

-- ------------------------------------------------------------------
-- 4) VERIFIKASI HASIL (hanya membaca)
--    Harus muncul 3 baris index, dan nip_bersih harus terisi penuh.
-- ------------------------------------------------------------------
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS kolom
  FROM information_schema.statistics
 WHERE table_schema = DATABASE()
   AND index_name IN ('idx_stp_nip_bersih', 'idx_st_created', 'idx_st_katim_status')
 GROUP BY table_name, index_name
 ORDER BY table_name, index_name;

SELECT column_name, column_type, extra, generation_expression
  FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'surat_tugas_peserta'
   AND column_name = 'nip_bersih';

SELECT COUNT(*) AS peserta_total,
       SUM(nip_bersih IS NOT NULL) AS nip_bersih_terisi
  FROM surat_tugas_peserta;

-- ------------------------------------------------------------------
-- 5) (OPSIONAL) Hapus index yang tidak dipakai query mana pun.
--     `kegiatan_id` hanya ditulis (snapshot referensi ke talawang) dan
--     tidak pernah dipakai pada WHERE / ORDER BY, jadi index ini hanya
--     menambah biaya tulis. Buka komentar bila ingin dibersihkan.
--     Sudah dibungkus pengecekan agar aman diulang.
-- ------------------------------------------------------------------
-- SET @ada := (SELECT COUNT(*) FROM information_schema.statistics
--               WHERE table_schema = DATABASE() AND table_name = 'surat_tugas'
--                 AND index_name = 'idx_st_kegiatan');
-- SET @ddl := IF(@ada = 0, 'DO 0', 'ALTER TABLE surat_tugas DROP INDEX idx_st_kegiatan');
-- PREPARE q FROM @ddl; EXECUTE q; DEALLOCATE PREPARE q;
