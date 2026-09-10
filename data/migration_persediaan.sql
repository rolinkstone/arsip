-- =============================================
-- Migration: Persediaan (Inventory Management)
-- Tabel untuk modul Manajemen Persediaan
-- =============================================

-- 1. MASTER BARANG PERSEDIAAN
CREATE TABLE IF NOT EXISTS barang_persediaan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_barang VARCHAR(255) NOT NULL,
    jenis VARCHAR(100) DEFAULT '',
    kategori VARCHAR(100) DEFAULT '',
    satuan VARCHAR(50) NOT NULL,
    saldo INT DEFAULT 0,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. BARANG MASUK (User Gudang upload kuitansi -> Kabag TU approve)
CREATE TABLE IF NOT EXISTS barang_masuk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barang_id INT NOT NULL,
    jumlah INT NOT NULL,
    kuitansi_url VARCHAR(500) DEFAULT NULL,
    catatan TEXT DEFAULT NULL,
    tanggal_pembelian DATE DEFAULT NULL,
    status ENUM('diajukan', 'disetujui', 'ditolak') DEFAULT 'diajukan',
    created_by VARCHAR(100) DEFAULT NULL,
    approved_by_kabag_tu VARCHAR(100) DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang_persediaan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. PERMINTAAN BARANG (PIC Persediaan request -> Katim -> Kabag -> PIC Gudang deliver)
CREATE TABLE IF NOT EXISTS permintaan_barang (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(36) DEFAULT NULL,
    tanggal_permintaan DATE DEFAULT NULL,
    barang_id INT NOT NULL,
    jumlah INT NOT NULL,
    jumlah_diminta INT DEFAULT 0,
    catatan TEXT DEFAULT NULL,
    status ENUM('draft', 'diajukan', 'menunggu_katim', 'disetujui_katim', 'disetujui_kabag', 'diserahkan', 'diserahkan_sebagian', 'ditolak') DEFAULT 'draft',
    requested_by VARCHAR(100) DEFAULT NULL,
    katim_id VARCHAR(100) DEFAULT NULL,
    katim_nama VARCHAR(255) DEFAULT NULL,
    approved_katim_by VARCHAR(100) DEFAULT NULL,
    approved_katim_at DATETIME DEFAULT NULL,
    approved_kabag_by VARCHAR(100) DEFAULT NULL,
    approved_kabag_at DATETIME DEFAULT NULL,
    delivered_by VARCHAR(100) DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang_persediaan(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. STOK OPNAME
CREATE TABLE IF NOT EXISTS stok_opname (
    id INT AUTO_INCREMENT PRIMARY KEY,
    barang_id INT NOT NULL,
    stok_sistem INT NOT NULL,
    stok_nyata INT NOT NULL,
    selisih INT NOT NULL,
    tanggal DATE NOT NULL,
    catatan TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang_persediaan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) DEFAULT '',
    user_role VARCHAR(100) DEFAULT '',
    title VARCHAR(255) NOT NULL,
    message TEXT DEFAULT NULL,
    link VARCHAR(255) DEFAULT '',
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (user_role),
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
