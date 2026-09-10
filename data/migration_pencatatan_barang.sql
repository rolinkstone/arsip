-- =====================================================================
-- MIGRASI: PENCATATAN BARANG SEMENTARA (2026-09-02)
-- Dokumentasi barang yang sudah diterima/diambil tetapi belum diinput
-- oleh bagian keuangan (belum tersedia transaksinya di sistem).
--   tipe 'diterima' : barang diterima fisik, belum diinput keuangan
--   tipe 'diambil'  : barang diambil/diminta user sebelum input keuangan
--   status 'belum'   : masih perlu tindak lanjut (counter di sub-menu)
--   status 'selesai' : sudah diinput keuangan / sudah dicatat keluar
-- =====================================================================

USE pemeliharaan_aset_bpom;

CREATE TABLE IF NOT EXISTS pencatatan_barang_sementara (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipe ENUM('diterima', 'diambil') NOT NULL DEFAULT 'diterima',
    nama_barang VARCHAR(255) NOT NULL,
    jenis VARCHAR(100) DEFAULT NULL,
    kategori VARCHAR(100) DEFAULT NULL,
    jumlah INT NOT NULL DEFAULT 1,
    satuan VARCHAR(50) DEFAULT 'pcs',
    tanggal DATE DEFAULT NULL,
    sumber VARCHAR(255) DEFAULT NULL,
    penerima VARCHAR(255) DEFAULT NULL,
    penerima_id VARCHAR(100) DEFAULT NULL,
    catatan TEXT DEFAULT NULL,
    status ENUM('belum', 'selesai') NOT NULL DEFAULT 'belum',
    status_catatan TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT NULL,
    INDEX idx_tipe_status (tipe, status),
    INDEX idx_nama (nama_barang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
