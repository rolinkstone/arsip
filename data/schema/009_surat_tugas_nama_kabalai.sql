-- ============================================================
-- Migrasi 009: SNAPSHOT NAMA KEPALA BALAI PER SURAT TUGAS
-- ============================================================
-- Menambah kolom `surat_tugas.nama_kabalai`:
--   nama Kepala Balai (penandatangan) yang BERLAKU SAAT ST DIBUAT,
--   disimpan per ST sebagai snapshot.
--
-- ALASAN (permintaan user 2026-09-12):
--   "ketika ganti ka balai, surat tugas yang sudah terbit itu masih
--    pakai nama_kabalai lama"
--   Jadi ST yang sudah terbit TIDAK ikut berubah saat pimpinan berganti.
--
-- Hubungan dengan setting global `app_setting.ttd_kepala_nama`
-- (Pengaturan → Pejabat Penandatangan):
--   • Nilai global = DEFAULT yang diisikan otomatis ke kolom ini saat
--     membuat ST baru (masih bisa diubah manual di form).
--   • Saat cetak, urutan yang dipakai:
--        surat_tugas.nama_kabalai
--        → setting global ttd_kepala_nama   (ST lama sebelum migrasi ini)
--        → konstanta TTD_KEPALA_NAMA di komponen cetak (cadangan terakhir)
--
-- Idempotent TIDAK bisa dengan satu ALTER biasa; jalankan sekali saja.
-- Jalankan:
--   mysql -h 127.0.0.1 -P 3306 -u root < data/schema/009_surat_tugas_nama_kabalai.sql
-- ============================================================

USE bpom_arsip_surat;

ALTER TABLE surat_tugas
    ADD COLUMN nama_kabalai VARCHAR(150) NULL
        COMMENT 'Snapshot nama Kepala Balai (penandatangan) saat ST dibuat'
        AFTER tempat_terbit;

-- ST yang sudah ada: isi dari setting global agar hasil cetaknya tidak berubah
-- (dijalankan hanya bila kolom baru saja ditambahkan & setting tersedia).
UPDATE surat_tugas st
   JOIN app_setting s ON s.setting_key = 'ttd_kepala_nama'
   SET st.nama_kabalai = NULLIF(TRIM(s.setting_value), '')
 WHERE st.nama_kabalai IS NULL;

SELECT COUNT(*) AS jumlah_st_memakai_nama_kabalai FROM surat_tugas WHERE nama_kabalai IS NOT NULL;
