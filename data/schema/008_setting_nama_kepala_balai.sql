-- ============================================================
-- 008 — SETTING: NAMA KEPALA BALAI (pejabat penandatangan)
-- ============================================================
-- Menambahkan satu baris di tabel app_setting:
--     ttd_kepala_nama = Nama Kepala Balai yang tercetak pada
--                       Surat Tugas, halaman lampiran, dan SPD/SPPD.
--
-- Sebelumnya nama ini DI-HARDCODE di komponen cetak
-- (`const TTD_KEPALA_NAMA = '...'` pada CetakSuratTugas.js & CetakSPD.js),
-- sehingga setiap ganti pimpinan harus ubah kode + build ulang.
-- Sekarang cukup diubah lewat: Pengaturan → Pejabat Penandatangan
-- (backend: routes/pejabat.js, helper: utils/pengaturan.js).
--
-- Baris ini SENGAJA diisi nama yang berlaku saat ini agar hasil cetak
-- tidak berubah setelah migrasi. Ganti nilainya lewat halaman pengaturan.
--
-- Idempoten: INSERT IGNORE → aman dijalankan berulang; nilai yang sudah
-- pernah diubah lewat aplikasi TIDAK ditimpa.
-- ============================================================

USE bpom_arsip_surat;

INSERT IGNORE INTO app_setting (setting_key, setting_value, keterangan) VALUES
('ttd_kepala_nama',
 'Ali Yudhi Hartanto, SF., Apt., MM',
 'Nama Kepala Balai yang tercetak pada Surat Tugas, Lampiran, dan SPD');

SELECT setting_key, setting_value, keterangan FROM app_setting WHERE setting_key = 'ttd_kepala_nama';
