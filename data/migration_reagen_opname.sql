-- =============================================
-- Migration: Stok Opname Reagen (Gudang / botol)
--
-- Mencatat hasil hitung fisik stok GUDANG reagen
-- (satuan BOTOL) dan mengoreksi reagen.saldo_botol,
-- sama seperti stok_opname pada Persediaan ATK.
--
-- Catatan: selisih opname hanya mengoreksi saldo
-- agregat (reagen.saldo_botol). Rincian per batch
-- (reagen_batch.stok_botol) tidak diubah otomatis.
-- =============================================

CREATE TABLE IF NOT EXISTS reagen_opname (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reagen_id INT NOT NULL,
    stok_sistem INT NOT NULL,
    stok_nyata INT NOT NULL,
    selisih INT NOT NULL,
    tanggal DATE NOT NULL,
    catatan TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reagen_id) REFERENCES reagen(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
