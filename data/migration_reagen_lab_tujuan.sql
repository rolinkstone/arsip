-- =============================================
-- Migration: LAB TUJUAN untuk Persediaan Reagen
--
-- Menambahkan field lab_tujuan untuk membedakan
-- penggunaan reagen per LAB:
--   - pangan  (LAB Pangan)
--   - mikro   (LAB Mikro)
--   - terano  (LAB Terano)
--
-- Setiap item permohonan (reagen_pengeluaran) bisa
-- memilih lab tujuannya. Saat diserahkan ke LAB,
-- stok lab (reagen_lab_stok) ikut ditandai lab tujuan.
--
-- Jalankan sekali pada database yang sudah ada.
-- =============================================

-- 1. PENGELUARAN / PERMOHONAN (per item)
ALTER TABLE reagen_pengeluaran
  ADD COLUMN lab_tujuan ENUM('pangan','mikro','terano') DEFAULT 'pangan' AFTER no_batch;

-- 2. STOK LAB (setiap botol yang diterima ditandai lab tujuan)
ALTER TABLE reagen_lab_stok
  ADD COLUMN lab_tujuan ENUM('pangan','mikro','terano') DEFAULT 'pangan' AFTER asal_pengeluaran_id;
