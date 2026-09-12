# Skema Database — bpom_arsip_surat

Folder ini berisi migrasi SQL untuk aplikasi **Persuratan / Arsip Surat (ECIPAR POM)**.

> ⚠️ File `*.sql` di `data/` (root) adalah migrasi lama aplikasi **pemeliharaan_aset_bpom**
> yang sudah tidak terpakai. Jangan dijalankan ke `bpom_arsip_surat`.

## Cara pakai

Jalankan migrasi secara berurutan (urut nomor prefix):

```bash
# Dari root proyek (DEVELOPMENT — nama database: bpom_arsip_surat)
mysql -h 127.0.0.1 -P 3306 -u root < data/schema/001_create_database.sql
mysql -h 127.0.0.1 -P 3306 -u root bpom_arsip_surat < data/schema/002_xxx.sql
```

### ⚠️ Nama database di PRODUCTION BERBEDA

Semua file `00X_*.sql` di folder ini berisi `USE bpom_arsip_surat;`, dan
`001_create_database.sql` membuat database dengan nama itu. Di server
production nama databasenya **`surat_bbpompky`** (lihat `DB_NAME` di `.env`).
Kalau file dijalankan apa adanya, migrasi akan masuk ke database yang SALAH.

Urutan yang benar di server (hanya sekali, saat menyiapkan database):

```bash
# 1) buat database production
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS surat_bbpompky CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) buat salinan skrip dengan nama database production (file asli tidak diubah)
mkdir -p /tmp/migrasi
for f in data/schema/00*.sql; do sed 's/bpom_arsip_surat/surat_bbpompky/g' "$f" > "/tmp/migrasi/$(basename "$f")"; done

# 3) jalankan berurutan
for f in /tmp/migrasi/00*.sql; do echo "== $(basename "$f")"; mysql -u root -p surat_bbpompky < "$f"; done
```

Setelah itu jangan lupa beri hak akses user aplikasi (production: `bbpom_surat_arsip`):

```sql
GRANT ALL PRIVILEGES ON surat_bbpompky.* TO 'bbpom_surat_arsip'@'localhost';
FLUSH PRIVILEGES;
```

## Aturan penulisan migrasi

- Prefix nomor urut: `001_`, `002_`, dst.
- Gunakan `utf8mb4` / `utf8mb4_unicode_ci`.
- Setiap file migrasi **idempotent** bila memungkinkan (`CREATE TABLE IF NOT EXISTS`, dll).
- Satu modul/fitur = satu (atau beberapa) file migrasi yang jelas penamaannya,
  contoh: `003_surat_masuk.sql`.

## Daftar migrasi

| File | Keterangan |
|------|------------|
| `001_create_database.sql` | Pastikan database `bpom_arsip_surat` ada (charset utf8mb4) |
| `008_setting_nama_kepala_balai.sql` | Seed setting `ttd_kepala_nama` — nama Kepala Balai pada cetak ST/lampiran/SPD (diatur di Pengaturan → Pejabat Penandatangan) |
| `009_surat_tugas_nama_kabalai.sql` | Kolom `surat_tugas.nama_kabalai` — snapshot nama Kepala Balai per ST (ST terbit tetap pakai nama lama saat pimpinan berganti) |
