-- =============================================
-- Migration: Persediaan Reagen (Chemical Inventory)
-- Tabel untuk modul Persediaan Reagen
--
-- KATEGORI:
--   - Bahan Kimia Padat   (kode_barang 1010102001)
--   - Bahan Kimia Cair    (kode_barang 1010102002)
--   - Bahan Kimia Lainnya (kode_barang 1010102999)
--
-- FLOW:
--   Gudang (satuan BOTOL) --> LAB (pencatatan per GRAM / mL)
--   - Barang masuk gudang dicatat per batch + tanggal kadaluarsa
--   - Satu barang bisa punya BANYAK batch dengan expiry berbeda
--   - Pengeluaran gudang ke LAB mengurangi stok botol & menambah
--     stok LAB (berat per botol dihitung ulang per gram/mL)
-- =============================================

-- 1. MASTER REAGEN
CREATE TABLE IF NOT EXISTS reagen (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_barang VARCHAR(20) DEFAULT '',
    no_urut VARCHAR(10) DEFAULT '',
    kategori ENUM('Bahan Kimia Padat','Bahan Kimia Cair','Bahan Kimia Lainnya') DEFAULT 'Bahan Kimia Padat',
    nama_barang VARCHAR(255) NOT NULL,
    berat_volume VARCHAR(50) DEFAULT '',
    satuan_kemasan VARCHAR(50) DEFAULT 'Botol',
    kode_lama VARCHAR(100) DEFAULT '',
    satuan VARCHAR(50) DEFAULT 'Botol',
    saldo_botol INT DEFAULT 0,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. BATCH / STOK PER EXPIRY (satu barang bisa punya beberapa batch/expiry)
CREATE TABLE IF NOT EXISTS reagen_batch (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reagen_id INT NOT NULL,
    no_batch VARCHAR(100) DEFAULT '',
    tanggal_kadaluarsa DATE DEFAULT NULL,
    stok_botol INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reagen_id) REFERENCES reagen(id) ON DELETE CASCADE,
    INDEX idx_reagen_exp (reagen_id, tanggal_kadaluarsa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. BARANG MASUK GUDANG (dengan batch & tanggal kadaluarsa)
CREATE TABLE IF NOT EXISTS reagen_masuk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reagen_id INT NOT NULL,
    no_batch VARCHAR(100) DEFAULT '',
    jumlah_botol INT NOT NULL,
    tanggal_kadaluarsa DATE DEFAULT NULL,
    kuitansi_url VARCHAR(500) DEFAULT NULL,
    catatan TEXT DEFAULT NULL,
    tanggal_pembelian DATE DEFAULT NULL,
    status ENUM('diajukan','disetujui','ditolak') DEFAULT 'disetujui',
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reagen_id) REFERENCES reagen(id) ON DELETE CASCADE,
    INDEX idx_reagen_masuk (reagen_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. PENGELUARAN GUDANG KE LAB (satuan botol)
-- Alur (sama seperti ATK): PIC Lab ajukan -> diketahui Katim -> disetujui Kabag TU -> diserahkan PIC Gudang
CREATE TABLE IF NOT EXISTS reagen_pengeluaran (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(36) DEFAULT NULL,
    reagen_id INT NOT NULL,
    batch_id INT DEFAULT NULL,
    no_batch VARCHAR(100) DEFAULT '',
    jumlah_botol INT NOT NULL,
    jumlah_diminta INT DEFAULT 0,
    catatan TEXT DEFAULT NULL,
    status ENUM('draft','diajukan','menunggu_katim','disetujui_katim','disetujui_kabag','diserahkan','diserahkan_sebagian','ditolak') DEFAULT 'draft',
    requested_by VARCHAR(100) DEFAULT NULL,
    katim_id VARCHAR(100) DEFAULT NULL,
    katim_nama VARCHAR(255) DEFAULT NULL,
    approved_katim_by VARCHAR(100) DEFAULT NULL,
    approved_katim_at DATETIME DEFAULT NULL,
    approved_kabag_by VARCHAR(100) DEFAULT NULL,
    approved_kabag_at DATETIME DEFAULT NULL,
    approved_by VARCHAR(100) DEFAULT NULL,
    approved_at DATETIME DEFAULT NULL,
    delivered_by VARCHAR(100) DEFAULT NULL,
    delivered_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reagen_id) REFERENCES reagen(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- UPGRADE untuk database yang sudah ada:
-- Jalankan blok berikut sekali jika tabel reagen_pengeluaran
-- sudah pernah dibuat (versi sebelum alur approval berjenjang).
-- =============================================
-- ALTER TABLE reagen_pengeluaran
--   MODIFY status ENUM('draft','diajukan','menunggu_katim','disetujui_katim','disetujui_kabag','diserahkan','diserahkan_sebagian','ditolak') DEFAULT 'draft',
--   ADD COLUMN katim_id VARCHAR(100) DEFAULT NULL AFTER requested_by,
--   ADD COLUMN katim_nama VARCHAR(255) DEFAULT NULL AFTER katim_id,
--   ADD COLUMN approved_katim_by VARCHAR(100) DEFAULT NULL AFTER katim_nama,
--   ADD COLUMN approved_katim_at DATETIME DEFAULT NULL AFTER approved_katim_by,
--   ADD COLUMN approved_kabag_by VARCHAR(100) DEFAULT NULL AFTER approved_katim_at,
--   ADD COLUMN approved_kabag_at DATETIME DEFAULT NULL AFTER approved_kabag_by;

-- 5. STOK LAB (per botol yang diterima dari gudang, dihitung per gram/mL)
CREATE TABLE IF NOT EXISTS reagen_lab_stok (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reagen_id INT NOT NULL,
    batch_id INT DEFAULT NULL,
    asal_pengeluaran_id INT DEFAULT NULL,
    berat_awal DECIMAL(12,3) DEFAULT 0,
    sisa_berat DECIMAL(12,3) DEFAULT 0,
    satuan_lab VARCHAR(10) DEFAULT 'g',
    tanggal_masuk_lab DATE DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reagen_id) REFERENCES reagen(id) ON DELETE CASCADE,
    INDEX idx_reagen_lab (reagen_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. PEMAKAIAN LAB (pencatatan keluar per gram/mL)
CREATE TABLE IF NOT EXISTS reagen_lab_pemakaian (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lab_stok_id INT NOT NULL,
    jumlah DECIMAL(12,3) NOT NULL,
    tanggal DATE DEFAULT NULL,
    catatan TEXT DEFAULT NULL,
    created_by VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lab_stok_id) REFERENCES reagen_lab_stok(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- SEED DATA: MASTER REAGEN
-- (tanggal kadaluarsa diisi sendiri via input stok/batch)
-- =============================================

-- ========== KATEGORI: BAHAN KIMIA PADAT (1010102001) ==========
INSERT INTO reagen (kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan) VALUES
('1010102001', '000002', 'Bahan Kimia Padat', 'S15A. Sodium Sulphate Anhydrous', '1000 g', 'Botol', 'A-2053-1KG - L9', 'Botol'),
('1010102001', '000005', 'Bahan Kimia Padat', 'S14A. Sodium Carbonate Anhydrous', '1000 g', 'Botol', 'A-2048-1KG - L9', 'Botol'),
('1010102001', '000006', 'Bahan Kimia Padat', 'A9B. Starch Soluble / Amylum', '500 g', 'Botol', 'A-2089-500g - L1', 'Botol'),
('1010102001', '000007', 'Bahan Kimia Padat', 'S10A. Sodium Hydroxide Pellets', '1000 g', 'Botol', 'A-2052', 'Botol'),
('1010102001', '000191', 'Bahan Kimia Padat', 'A30b. Asam Boric / Boric Acid', '1000 g', 'Botol', 'A-2013-1KG - L2', 'Botol'),
('1010102001', '000367', 'Bahan Kimia Padat', 'P22B. Potassium Sulphate', '1000 g', 'Botol', 'A-2043-1KG - L9', 'Botol'),
('1010102001', '000399', 'Bahan Kimia Padat', 'T14A. Titriplex III', '100 g', 'Botol', '1.08418.0100 -- L10.T6', 'Botol'),
('1010102001', '000414', 'Bahan Kimia Padat', 'A11A. Ammonium Sulphate', '1000 g', 'Botol', 'A-2009-1KG - L1', 'Botol'),
('1010102001', '000443', 'Bahan Kimia Padat', 'S19A. Natrium Sodium Sulfate Anhydrous', '1000 g', 'Botol', '1.06649.1000 -- L9.S17', 'Botol'),
('1010102001', '000479', 'Bahan Kimia Padat', 'P2B. Palladium Chloride (Purified)', '1 g', 'Botol', 'A-2158 - L9', 'Botol'),
('1010102001', '000495', 'Bahan Kimia Padat', 'T31B. Tetra-N-Butylammonium Hydrogen Sulfate', '100 g', 'Botol', '8.18858.0100 - L10', 'Botol'),
('1010102001', '000525', 'Bahan Kimia Padat', 'Potassium Iodide', '500 g', 'Botol', 'A-2039', 'Botol'),
('1010102001', '000526', 'Bahan Kimia Padat', 'Ammonium Acetate', '1000 g', 'Botol', 'A-2001', 'Botol'),
('1010102001', '000527', 'Bahan Kimia Padat', 'Zink Sulphate Heptahydrate', '1000 g', 'Botol', 'A-2100', 'Botol'),
('1010102001', '000535', 'Bahan Kimia Padat', 'Starch Soluble', '1000 g', 'Botol', 'A-2089', 'Botol'),
('1010102001', '000536', 'Bahan Kimia Padat', 'Di-Sodium Tetraborate Decahydrate (Borax)', '500 g', 'Botol', 'A-2140', 'Botol'),
('1010102001', '000537', 'Bahan Kimia Padat', 'Ammonium Phosphate Monobasic', '1 KG', 'Botol', 'A-2072', 'Botol'),
('1010102001', '000538', 'Bahan Kimia Padat', 'Ammonium Bicarbonate', '1 KG', 'Botol', 'A-2011', 'Botol'),
('1010102001', '000539', 'Bahan Kimia Padat', 'Sodium Dihydro. Orthophos. Anhydrous', '1 KG', 'Botol', 'A-2133', 'Botol'),
('1010102001', '000540', 'Bahan Kimia Padat', 'Sodium Acetate Anhydrous', '1 KG', 'Botol', 'A-2154', 'Botol'),
('1010102001', '000542', 'Bahan Kimia Padat', 'Ammonium Formate, Reagent Grade 97%', '500 g', 'Botol', '156264-500G', 'Botol'),
('1010102001', '000559', 'Bahan Kimia Padat', 'POTASSIUM CHROMATE, KALIUM KROMAT, K2CRO4', '500 g', 'Botol', 'A-2034', 'Botol'),
('1010102001', '000534', 'Bahan Kimia Padat', 'Sodium Thiosulphate Pentahydrate', '1000 g', 'Botol', 'A-2056', 'Botol'),
('1010102001', '000583', 'Bahan Kimia Padat', 'Glisin / Glycine', '250 g', 'Botol', 'A-2116-250GR', 'Botol'),
('1010102001', '000584', 'Bahan Kimia Padat', 'Methyl Red / Indikator Metil Merah (AR)', '25 g', 'Botol', 'A-2130-25GR', 'Botol'),
('1010102001', '000586', 'Bahan Kimia Padat', 'Alizarin Dye content 97%', '-', 'Botol', '122777', 'Botol');

-- ========== KATEGORI: BAHAN KIMIA CAIR (1010102002) ==========
INSERT INTO reagen (kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan) VALUES
('1010102002', '000004', 'Bahan Kimia Cair', 'T30B. Tetramethylammonium Hydroxide Solution 10%', '50 mL', 'Botol', '1.08123.0050', 'Botol'),
('1010102002', '000005', 'Bahan Kimia Cair', 'N,N-Dimethylformamide For Analysis', '2500 mL', 'Botol', '1.03053.2500 -- R5', 'Botol'),
('1010102002', '000011', 'Bahan Kimia Cair', 'A31. Asam Formiat / Formic Acid 98-100%', '1000 mL', 'Botol', '1.00264.1000 - R2', 'Botol'),
('1010102002', '000012', 'Bahan Kimia Cair', 'A32. Asam Fosfat (Ortho fosfat)', '2500 mL', 'Botol', '1.00573.2500 - R2', 'Botol'),
('1010102002', '000023', 'Bahan Kimia Cair', 'M9E. Methanol LCMS', '4000 mL', 'Botol', '1.06035.4000', 'Botol'),
('1010102002', '000024', 'Bahan Kimia Cair', 'E6. Etil Asetat', '2500 mL', 'Botol', '1.09623.2500 - R1', 'Botol'),
('1010102002', '000026', 'Bahan Kimia Cair', 'M9. Methanol', '2500 mL', 'Botol', '1.06009.2500 -- L7.R4', 'Botol'),
('1010102002', '000028', 'Bahan Kimia Cair', 'E3. Ethanol Absolute', '2500 mL', 'Botol', '1.00983.2500 - R6', 'Botol'),
('1010102002', '000029', 'Bahan Kimia Cair', 'A37. Asam klorida-Hidroflorik acid', '2500 mL', 'Botol', '1.00317.2500 - R1', 'Botol'),
('1010102002', '000032', 'Bahan Kimia Cair', 'A54b. Solvent', '2500 mL', 'Botol', '1.88015.2500 - R3', 'Botol'),
('1010102002', '000034', 'Bahan Kimia Cair', 'A50a. Acetonitrile LCMS', '4000 mL', 'Botol', '1.00029.4000 - R6', 'Botol'),
('1010102002', '000043', 'Bahan Kimia Cair', 'Spiritus', '-', 'Botol', '-', 'Botol'),
('1010102002', '000046', 'Bahan Kimia Cair', 'A53B. Acetonitrile (HPLC grade)', '4000 mL', 'Botol', '1.00030.4000', 'Botol'),
('1010102002', '000048', 'Bahan Kimia Cair', 'T1A. Tetrahidrofuran', '2500 mL', 'Botol', '1.09731.2500 -- R3', 'Botol'),
('1010102002', '000059', 'Bahan Kimia Cair', 'N-Heptane', '-', 'Botol', 'A-1046', 'Botol'),
('1010102002', '000065', 'Bahan Kimia Cair', 'B24A. Buffer Solution pH 7', '30x30 mL sachet', 'Sachet', '1.99002.0001 - R8', 'Sachet'),
('1010102002', '000083', 'Bahan Kimia Cair', 'A52A. Acetone For Analysis', '2500 mL', 'Botol', '1.00014.2500', 'Botol'),
('1010102002', '000086', 'Bahan Kimia Cair', 'M9D. Methanol Hypergrade For Liquid Chromatog', '2500 mL', 'Botol', '1.06035.2500', 'Botol'),
('1010102002', '000089', 'Bahan Kimia Cair', 'B4. Boron Tryfluoride Methanol', '500 mL', 'Botol', '8.01663.0500', 'Botol'),
('1010102002', '000104', 'Bahan Kimia Cair', 'T30A. Tetramethylammonium Hydroxide Solution 10%', '250 mL', 'Botol', '1.08123.0250', 'Botol'),
('1010102002', '000105', 'Bahan Kimia Cair', 'P20B. 2-Propanol', '4000 mL', 'Botol', 'A4514-4 - USE', 'Botol'),
('1010102002', '000115', 'Bahan Kimia Cair', 'Methanol (HPLC Grade)', '4 L', 'Botol', 'H-1058', 'Botol'),
('1010102002', '000116', 'Bahan Kimia Cair', 'Acetonitrile (HPLC Grade)', '4 L', 'Botol', 'H-1010', 'Botol'),
('1010102002', '000123', 'Bahan Kimia Cair', 'Hydrocloric Acid 37%', '-', 'Botol', 'A-1050', 'Botol'),
('1010102002', '000124', 'Bahan Kimia Cair', 'Diethyl Ether', '4 L', 'Botol', 'A-1033', 'Botol'),
('1010102002', '000125', 'Bahan Kimia Cair', 'Sulfuric Acid 98%', '2.5 L', 'Botol', 'A-1092', 'Botol'),
('1010102002', '000126', 'Bahan Kimia Cair', 'Acetone', '4 L', 'Botol', 'A-1005', 'Botol'),
('1010102002', '000127', 'Bahan Kimia Cair', 'Triflouroacetic acid', '-', 'Botol', '8.08260.0101', 'Botol'),
('1010102002', '000129', 'Bahan Kimia Cair', 'Tetra-a-butylammonium hydroxide solution', '1000 mL', 'Botol', '1.09162.1000', 'Botol'),
('1010102002', '000132', 'Bahan Kimia Cair', 'Nitric Acid 65%', '-', 'Botol', 'A-1063 B', 'Botol'),
('1010102002', '000133', 'Bahan Kimia Cair', 'Ethanol 98% (ABSOLUTE)', '4 L', 'Botol', 'A-1035', 'Botol'),
('1010102002', '000134', 'Bahan Kimia Cair', 'Cyclohexane', '4 L', 'Botol', 'A-1024', 'Botol'),
('1010102002', '000135', 'Bahan Kimia Cair', 'Phosporic Acid 85%', '2.5 L', 'Botol', 'A-1076', 'Botol'),
('1010102002', '000136', 'Bahan Kimia Cair', 'Ethyl Acetat', '4 L', 'Botol', 'A-1038', 'Botol'),
('1010102002', '000138', 'Bahan Kimia Cair', 'N-Hexane', '4 L', 'Botol', 'A-1045', 'Botol'),
('1010102002', '000141', 'Bahan Kimia Cair', 'Ammonia Solution', '2.5 L', 'Botol', 'A-1011', 'Botol'),
('1010102002', '000142', 'Bahan Kimia Cair', 'Formic Acid 98%', '1 L', 'Botol', 'A-1041', 'Botol'),
('1010102002', '000143', 'Bahan Kimia Cair', 'Sodium Hypochlorite Solution', '500 mL', 'Botol', 'A-1096 A', 'Botol'),
('1010102002', '000147', 'Bahan Kimia Cair', 'Methanol for gas chromatography', '1000 mL', 'Botol', '1.00837.1000', 'Botol'),
('1010102002', '000148', 'Bahan Kimia Cair', 'Tetrametilamonia hidroksida', '250 mL', 'Botol', '8.14748.0250', 'Botol'),
('1010102002', '000149', 'Bahan Kimia Cair', 'Titrant 5', '1 L', 'Botol', '1.88010.2500', 'Botol'),
('1010102002', '000033', 'Bahan Kimia Cair', 'M9C. Methanol gradient', '4000 mL', 'Botol', '1.06007.4000 - R4', 'Botol'),
('1010102002', '000152', 'Bahan Kimia Cair', 'Tetrahydrofuran, ACS', '1000 mL', 'Botol', '1.09731.1000', 'Botol'),
('1010102002', '000153', 'Bahan Kimia Cair', 'Ammonia solution 32%', '2.5 L', 'Botol', '1.05426.2511', 'Botol'),
('1010102002', '000154', 'Bahan Kimia Cair', 'FISCHER CHEMICAL ACETONITRILE (HPLC) GRADE', '-', 'Botol', 'A998-4', 'Botol'),
('1010102002', '000155', 'Bahan Kimia Cair', 'Methanol 99% (GC), suitable for GC/MS', '2500 g', 'Botol', '1.00837.2500', 'Botol'),
('1010102002', '000156', 'Bahan Kimia Cair', 'Fisher Chemical Methanol (HPLC)', '4000 g', 'Botol', 'A452-4', 'Botol'),
('1010102002', '000161', 'Bahan Kimia Cair', 'PERCHLORIC ACID 70%', '2.5 L', 'Botol', 'A-1074-2.5LT', 'Botol'),
('1010102002', '000163', 'Bahan Kimia Cair', 'Tetra metil amonium hidroksida', '1000 mL', 'Botol', '8.14748.1000', 'Botol'),
('1010102002', '000164', 'Bahan Kimia Cair', 'Boron trifluoride-methanol solution ~10%', '-', 'Botol', '15716', 'Botol');

-- ========== KATEGORI: BAHAN KIMIA LAINNYA (1010102999) ==========
INSERT INTO reagen (kode_barang, no_urut, kategori, nama_barang, berat_volume, satuan_kemasan, kode_lama, satuan) VALUES
('1010102999', '000078', 'Bahan Kimia Lainnya', 'B25A. Buffer Solution pH 10', '-', 'Kotak', '1.99004.0001 -- R9', 'Kotak'),
('1010102999', '000090', 'Bahan Kimia Lainnya', 'D27. Dikalium di-potassium hidrogen fosfat', '1000 g', 'Botol', '1.05104.1000 - L4.D17', 'Botol'),
('1010102999', '000129', 'Bahan Kimia Lainnya', 'I4a. Iso Oktan', '1000 mL', 'Botol', '1.04727.2500', 'Botol'),
('1010102999', '000132', 'Bahan Kimia Lainnya', 'I7. Isobutilmetilketon', '-', 'Botol', '1.06146.1000', 'Botol'),
('1010102999', '000133', 'Bahan Kimia Lainnya', 'K1B. Kalium Dikromat', '80 mg', 'Botol', '1.02403.0080 -- L6', 'Botol'),
('1010102999', '000172', 'Bahan Kimia Lainnya', 'k41. Kertas lakmus (pH) Indikator', '100 Test', 'Kotak', '1.09535.0001 -- R9', 'Kotak'),
('1010102999', '000214', 'Bahan Kimia Lainnya', 'K14A. Natrium Karbonat / Potassium Carbonate', '500 g', 'Botol', '1.04928.0500', 'Botol'),
('1010102999', '000250', 'Bahan Kimia Lainnya', 'A3A. Asam Heptafluorobutirat Acid', '25 g', 'Botol', '8.43443.0025', 'Botol'),
('1010102999', '000251', 'Bahan Kimia Lainnya', 'S6. Silica Gel GF 254 (glass plate 10x20 cm)', '-', 'Kotak', '1.05729.0001 -- R9', 'Kotak'),
('1010102999', '000318', 'Bahan Kimia Lainnya', 'S1A. Selenium Dioxide (Sublimed)', '250 g', 'Botol', '8.00653.0250 - L9', 'Botol'),
('1010102999', '000366', 'Bahan Kimia Lainnya', 'K35C. Kertas saring membran milipore 0,45 µm', 'dia. 13 mL', 'Kotak', '7184-001 -- R9', 'Kotak'),
('1010102999', '000395', 'Bahan Kimia Lainnya', 'P26. Parafilm M Roll', '4 X 125', 'Kotak', '9910001, PM 996 - R10', 'Kotak'),
('1010102999', '000421', 'Bahan Kimia Lainnya', 'A24a. Mquant Arsenic Test Spectroquant', '-', 'Kotak', '1.17917.0001', 'Kotak'),
('1010102999', '000427', 'Bahan Kimia Lainnya', 'R3A. Mercury test', '-', 'Kotak', '1001.006K', 'Kotak'),
('1010102999', '299945', 'Bahan Kimia Lainnya', 'Dietilamin', '2500 mL', 'Botol', '8.03010.2500', 'Botol'),
('1010102999', '299948', 'Bahan Kimia Lainnya', 'K45A. Chloroform / Kloroform', '2500 mL', 'Botol', '1.02445.2500', 'Botol'),
('1010102999', '299949', 'Bahan Kimia Lainnya', 'T16. Toluene for analysis ISO MERCK', '2500 mL', 'Botol', '1.08325.2500', 'Botol'),
('1010102999', '299950', 'Bahan Kimia Lainnya', 'S4A. Cyclohexane for analysis', '2500 mL', 'Botol', '1.09666.2500', 'Botol'),
('1010102999', '299970', 'Bahan Kimia Lainnya', 'Dinatrium / Disodium Hydrogen Phosphate Dihydrat', '1000 g', 'Botol', '1.06586.1000', 'Botol'),
('1010102999', '299983', 'Bahan Kimia Lainnya', 'B30A. Boiling chips', '100 g', 'Botol', '1.07913.0100 - L2', 'Botol'),
('1010102999', '300012', 'Bahan Kimia Lainnya', 'MQuant Lead Test Kit', '-', 'Kotak', '1.10077.0001', 'Kotak'),
('1010102999', '000042', 'Bahan Kimia Lainnya', 'D2. Di-ammonium Hidrogen fosfat', '500 g', 'Botol', '1.01207.0500 - L4.D7', 'Botol'),
('1010102999', '300106', 'Bahan Kimia Lainnya', 'S5. Silica Gel GF 254 (glass plate 20x20 cm)', '-', 'Kotak', '1.05715.0001 - R10', 'Kotak'),
('1010102999', '300114', 'Bahan Kimia Lainnya', 'T19. Trietil amin', '1000 mL', 'Botol', '8.08352.1000 - R3', 'Botol'),
('1010102999', '300161', 'Bahan Kimia Lainnya', 'P19. Propanol - 1 Extra Pure', '2500 mL', 'Botol', '1.00997.2500 -- R5', 'Botol'),
('1010102999', '300163', 'Bahan Kimia Lainnya', 'K4. Kalium Dihidrogen Fosfat / Potassium Dihydrogen Phosphate', '1000 g', 'Botol', '1.04873.1000 -- L6.K6', 'Botol'),
('1010102999', '300169', 'Bahan Kimia Lainnya', 'K37. Kertas saring Whatman 41', '-', 'Botol', '1441-125 USE', 'Botol'),
('1010102999', '300184', 'Bahan Kimia Lainnya', 'D28a. Dinatrium Hidrogen Fosfat Dodekahidrat', '500 g', 'Botol', '1.06579.0500 - L4', 'Botol'),
('1010102999', '300242', 'Bahan Kimia Lainnya', 'P20. 2-Propanol', '2500 mL', 'Botol', '1.09634.2500 - R5', 'Botol'),
('1010102999', '300327', 'Bahan Kimia Lainnya', 'Ammonium dihydrogen phosphate', '500 g', 'Botol', '1.01126.0500', 'Botol'),
('1010102999', '300333', 'Bahan Kimia Lainnya', 'M2. Magnesium Nitrat Hexadyrate', '500 g', 'Botol', '1.05853.0500 -- L7.M1', 'Botol'),
('1010102999', '300344', 'Bahan Kimia Lainnya', 'P7. Perak Nitrat / Silver Nitrat', '100 g', 'Botol', '1.01512.0100 -- L9.P6', 'Botol'),
('1010102999', '300362', 'Bahan Kimia Lainnya', 'R4. Rhodamin B test kit', '-', 'Botol', 'C-K RB003.50', 'Botol'),
('1010102999', '300372', 'Bahan Kimia Lainnya', 'F6. Formalin Test Kit', '-', 'Botol', 'C-KF001.50 -- R8', 'Botol'),
('1010102999', '300373', 'Bahan Kimia Lainnya', 'Test Kit Boraks', '-', 'Botol', 'Chem Kit Cat.No.C-K B002.50', 'Botol'),
('1010102999', '300374', 'Bahan Kimia Lainnya', 'M16. Methanil Yellow Kit', '-', 'Botol', 'C-K MY004.75-100 -- R8', 'Botol'),
('1010102999', '300491', 'Bahan Kimia Lainnya', 'Phosphate Buffered Saline, pH 7.4', '-', 'Botol', 'TS1101-Himedia', 'Botol'),
('1010102999', '300494', 'Bahan Kimia Lainnya', 'Acetic Acid Glacial', '2.5 L', 'Botol', 'A-1001', 'Botol'),
('1010102999', '300500', 'Bahan Kimia Lainnya', 'Potassium Phosphate', '1000 g', 'Botol', 'A-2131', 'Botol'),
('1010102999', '300504', 'Bahan Kimia Lainnya', 'Chloroform', '4 L', 'Botol', 'A-1022', 'Botol'),
('1010102999', '300507', 'Bahan Kimia Lainnya', 'Trifluoroacetic acid', '-', 'Botol', '8.08260.0101', 'Botol'),
('1010102999', '300509', 'Bahan Kimia Lainnya', 'Dichlorometan for analysis', '1000 mL', 'Botol', '1.06050.1000', 'Botol'),
('1010102999', '300530', 'Bahan Kimia Lainnya', 'Water for gas chromatography MS Suprasolve', '2500 mL', 'Botol', '1.03702.2500', 'Botol'),
('1010102999', '300531', 'Bahan Kimia Lainnya', 'Buffer solution pH 4', '30x30 mL sachet', 'Botol', '1.99001.0001', 'Botol'),
('1010102999', '300532', 'Bahan Kimia Lainnya', 'Buffer Solution pH 7', '30x30 mL sachet', 'Botol', '1.99002.0001', 'Botol'),
('1010102999', '300543', 'Bahan Kimia Lainnya', 'MQuant Lead Test Kit', '-', 'Kit', '1.10077.0001', 'Kit'),
('1010102999', '300542', 'Bahan Kimia Lainnya', 'MQuant Cyanide Test', '-', 'Kit', '1.10044.0001', 'Kit'),
('1010102999', '300544', 'Bahan Kimia Lainnya', 'MQuant Arsenic Test', '-', 'Kit', '1.17917.0001', 'Kit'),
('1010102999', '300545', 'Bahan Kimia Lainnya', 'POTASSIUM HYDROXIDE PELLETS, KOH PELLETS', '1 KG', 'Botol', 'A-2037', 'Botol'),
('1010102999', '300568', 'Bahan Kimia Lainnya', 'Sodium Carbonate', '500 g', 'Botol', '1.06392.0500', 'Botol'),
('1010102999', '300569', 'Bahan Kimia Lainnya', 'Sodium Acetate Trihydrate', '-', 'Botol', 'A-2047-1KG', 'Botol'),
('1010102999', '300578', 'Bahan Kimia Lainnya', 'Calcium Carbonate / Kalsium Karbonat', '-', 'Botol', 'A-2014-1KG', 'Botol');
