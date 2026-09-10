-- =============================================
-- SEED DEMO: Data contoh untuk tabel LAB
-- (alur lab akan disesuaikan lagi nanti)
--
-- Isi demo:
--   1. S15A. Sodium Sulphate Anhydrous  (Padat, 1000 g)      -> 2 batch beda expiry
--   2. A31. Asam Formiat 98-100%        (Cair, 1000 mL)      -> 2 batch (1 hampir expiry)
--   3. Acetic Acid Glacial              (Lainnya, 2.5 L)      -> 1 batch (sudah EXPIRED)
--
-- Bisa dijalankan berulang (idempotent): data demo lama dengan
-- prefix 'DEMO-' dibersihkan dulu sebelum diisi ulang.
-- =============================================

-- ========== 0. RESET DATA DEMO LAMA ==========
DELETE FROM reagen_lab_pemakaian
WHERE lab_stok_id IN (
    SELECT l.id FROM reagen_lab_stok l
    JOIN reagen_batch b ON l.batch_id = b.id
    WHERE b.no_batch LIKE 'DEMO-%'
);

DELETE FROM reagen_lab_stok
WHERE batch_id IN (SELECT id FROM reagen_batch WHERE no_batch LIKE 'DEMO-%');

DELETE FROM reagen_pengeluaran WHERE group_id LIKE 'DEMO-%';
DELETE FROM reagen_masuk WHERE no_batch LIKE 'DEMO-%';
DELETE FROM reagen_batch WHERE no_batch LIKE 'DEMO-%';

-- Reset saldo botol item demo
UPDATE reagen SET saldo_botol = 0
WHERE (kode_barang='1010102001' AND no_urut='000002')
   OR (kode_barang='1010102002' AND no_urut='000011')
   OR (kode_barang='1010102999' AND no_urut='300494');

-- =============================================
-- 1. S15A. Sodium Sulphate Anhydrous (Padat, 1000 g)
--    Batch A: 5 masuk, 2 keluar ke lab -> sisa 3
--    Batch B: 3 masuk                     -> sisa 3
--    Saldo gudang total: 6 botol
-- =============================================
SET @r1 := (SELECT id FROM reagen WHERE kode_barang='1010102001' AND no_urut='000002');

INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol)
VALUES (@r1, 'DEMO-P1-A', '2027-06-30', 3);
INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol)
VALUES (@r1, 'DEMO-P1-B', '2028-01-31', 3);

SET @b1a := (SELECT id FROM reagen_batch WHERE reagen_id=@r1 AND no_batch='DEMO-P1-A');
SET @b1b := (SELECT id FROM reagen_batch WHERE reagen_id=@r1 AND no_batch='DEMO-P1-B');

INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
VALUES (@r1, 'DEMO-P1-A', 5, '2027-06-30', '', 'Data demo', 'disetujui', 'demo-gudang', '2026-05-10');
INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
VALUES (@r1, 'DEMO-P1-B', 3, '2028-01-31', '', 'Data demo', 'disetujui', 'demo-gudang', '2026-06-15');

INSERT INTO reagen_pengeluaran (group_id, reagen_id, batch_id, no_batch, jumlah_botol, catatan, status, requested_by, approved_by, approved_at, delivered_by, delivered_at)
VALUES ('DEMO-P1', @r1, @b1a, 'DEMO-P1-A', 2, 'Data demo', 'diserahkan', 'demo-lab', 'demo-gudang', NOW(), 'demo-gudang', NOW());
SET @p1 := (SELECT id FROM reagen_pengeluaran WHERE group_id='DEMO-P1' AND batch_id=@b1a);

INSERT INTO reagen_lab_stok (reagen_id, batch_id, asal_pengeluaran_id, berat_awal, sisa_berat, satuan_lab, tanggal_masuk_lab)
VALUES (@r1, @b1a, @p1, 1000, 1000, 'g', '2026-08-01');
INSERT INTO reagen_lab_stok (reagen_id, batch_id, asal_pengeluaran_id, berat_awal, sisa_berat, satuan_lab, tanggal_masuk_lab)
VALUES (@r1, @b1a, @p1, 1000, 1000, 'g', '2026-08-01');

SET @ls1a := (SELECT id FROM reagen_lab_stok WHERE reagen_id=@r1 AND batch_id=@b1a ORDER BY id LIMIT 1);
SET @ls1b := (SELECT id FROM reagen_lab_stok WHERE reagen_id=@r1 AND batch_id=@b1a ORDER BY id LIMIT 1 OFFSET 1);

INSERT INTO reagen_lab_pemakaian (lab_stok_id, jumlah, tanggal, catatan, created_by)
VALUES (@ls1a, 350, '2026-08-05', 'Uji penetapan kadar', 'demo-lab');
UPDATE reagen_lab_stok SET sisa_berat = sisa_berat - 350 WHERE id=@ls1a;

INSERT INTO reagen_lab_pemakaian (lab_stok_id, jumlah, tanggal, catatan, created_by)
VALUES (@ls1b, 120, '2026-08-08', 'Kalibrasi alat', 'demo-lab');
UPDATE reagen_lab_stok SET sisa_berat = sisa_berat - 120 WHERE id=@ls1b;

UPDATE reagen SET saldo_botol = 6 WHERE id=@r1;

-- =============================================
-- 2. A31. Asam Formiat / Formic Acid 98-100% (Cair, 1000 mL)
--    Batch A: 4 masuk (expiry dekat), 1 keluar ke lab -> sisa 3
--    Batch B: 2 masuk                                  -> sisa 2
--    Saldo gudang total: 5 botol
-- =============================================
SET @r2 := (SELECT id FROM reagen WHERE kode_barang='1010102002' AND no_urut='000011');

INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol)
VALUES (@r2, 'DEMO-P2-A', '2026-10-15', 3);
INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol)
VALUES (@r2, 'DEMO-P2-B', '2027-03-20', 2);

SET @b2a := (SELECT id FROM reagen_batch WHERE reagen_id=@r2 AND no_batch='DEMO-P2-A');
SET @b2b := (SELECT id FROM reagen_batch WHERE reagen_id=@r2 AND no_batch='DEMO-P2-B');

INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
VALUES (@r2, 'DEMO-P2-A', 4, '2026-10-15', '', 'Data demo', 'disetujui', 'demo-gudang', '2026-04-20');
INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
VALUES (@r2, 'DEMO-P2-B', 2, '2027-03-20', '', 'Data demo', 'disetujui', 'demo-gudang', '2026-07-01');

INSERT INTO reagen_pengeluaran (group_id, reagen_id, batch_id, no_batch, jumlah_botol, catatan, status, requested_by, approved_by, approved_at, delivered_by, delivered_at)
VALUES ('DEMO-P2', @r2, @b2a, 'DEMO-P2-A', 1, 'Data demo', 'diserahkan', 'demo-lab', 'demo-gudang', NOW(), 'demo-gudang', NOW());
SET @p2 := (SELECT id FROM reagen_pengeluaran WHERE group_id='DEMO-P2' AND batch_id=@b2a);

INSERT INTO reagen_lab_stok (reagen_id, batch_id, asal_pengeluaran_id, berat_awal, sisa_berat, satuan_lab, tanggal_masuk_lab)
VALUES (@r2, @b2a, @p2, 1000, 1000, 'mL', '2026-08-02');

SET @ls2a := (SELECT id FROM reagen_lab_stok WHERE reagen_id=@r2 AND batch_id=@b2a ORDER BY id LIMIT 1);

INSERT INTO reagen_lab_pemakaian (lab_stok_id, jumlah, tanggal, catatan, created_by)
VALUES (@ls2a, 200, '2026-08-10', 'Preparasi sampel', 'demo-lab');
UPDATE reagen_lab_stok SET sisa_berat = sisa_berat - 200 WHERE id=@ls2a;

UPDATE reagen SET saldo_botol = 5 WHERE id=@r2;

-- =============================================
-- 3. Acetic Acid Glacial (Lainnya, 2.5 L = 2500 mL)
--    Batch A: 3 masuk (SUDAH EXPIRED 2025-12-01), 1 keluar ke lab -> sisa 2
--    Saldo gudang total: 2 botol
-- =============================================
SET @r3 := (SELECT id FROM reagen WHERE kode_barang='1010102999' AND no_urut='300494');

INSERT INTO reagen_batch (reagen_id, no_batch, tanggal_kadaluarsa, stok_botol)
VALUES (@r3, 'DEMO-P3-A', '2025-12-01', 2);

SET @b3a := (SELECT id FROM reagen_batch WHERE reagen_id=@r3 AND no_batch='DEMO-P3-A');

INSERT INTO reagen_masuk (reagen_id, no_batch, jumlah_botol, tanggal_kadaluarsa, kuitansi_url, catatan, status, created_by, tanggal_pembelian)
VALUES (@r3, 'DEMO-P3-A', 3, '2025-12-01', '', 'Data demo', 'disetujui', 'demo-gudang', '2024-11-05');

INSERT INTO reagen_pengeluaran (group_id, reagen_id, batch_id, no_batch, jumlah_botol, catatan, status, requested_by, approved_by, approved_at, delivered_by, delivered_at)
VALUES ('DEMO-P3', @r3, @b3a, 'DEMO-P3-A', 1, 'Data demo', 'diserahkan', 'demo-lab', 'demo-gudang', NOW(), 'demo-gudang', NOW());
SET @p3 := (SELECT id FROM reagen_pengeluaran WHERE group_id='DEMO-P3' AND batch_id=@b3a);

INSERT INTO reagen_lab_stok (reagen_id, batch_id, asal_pengeluaran_id, berat_awal, sisa_berat, satuan_lab, tanggal_masuk_lab)
VALUES (@r3, @b3a, @p3, 2500, 2500, 'mL', '2026-07-20');

SET @ls3a := (SELECT id FROM reagen_lab_stok WHERE reagen_id=@r3 AND batch_id=@b3a ORDER BY id LIMIT 1);

INSERT INTO reagen_lab_pemakaian (lab_stok_id, jumlah, tanggal, catatan, created_by)
VALUES (@ls3a, 100, '2026-08-07', 'Pengenceran', 'demo-lab');
UPDATE reagen_lab_stok SET sisa_berat = sisa_berat - 100 WHERE id=@ls3a;

UPDATE reagen SET saldo_botol = 2 WHERE id=@r3;

-- =============================================
-- RANGKUMAN DATA DEMO
-- =============================================
SELECT r.kode_barang, r.no_urut, r.nama_barang, r.berat_volume,
       r.saldo_botol AS saldo_gudang,
       (SELECT COUNT(*) FROM reagen_batch b WHERE b.reagen_id = r.id) AS jumlah_batch,
       (SELECT COUNT(*) FROM reagen_lab_stok l WHERE l.reagen_id = r.id) AS stok_lab
FROM reagen r
WHERE r.id IN (@r1, @r2, @r3);
