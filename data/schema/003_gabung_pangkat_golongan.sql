-- ============================================================
-- Migrasi 003: Gabungkan Pangkat & Golongan menjadi SATU kolom
-- Kolom `pangkat` menyimpan nilai gabungan "Pangkat / Golongan"
-- (mis. "Penata Muda Tingkat I / III b"), sesuai sumber nominatif.
-- Kolom `golongan` dihapus dari tabel surat_tugas_peserta & sppd.
-- ============================================================

USE bpom_arsip_surat;

-- Gabungkan dulu data lama agar tidak hilang
UPDATE surat_tugas_peserta
SET pangkat = CONCAT_WS(' / ', pangkat, golongan)
WHERE golongan IS NOT NULL AND golongan <> '';

UPDATE sppd
SET pangkat = CONCAT_WS(' / ', pangkat, golongan)
WHERE golongan IS NOT NULL AND golongan <> '';

-- Hapus kolom golongan
ALTER TABLE surat_tugas_peserta DROP COLUMN golongan;
ALTER TABLE sppd DROP COLUMN golongan;
