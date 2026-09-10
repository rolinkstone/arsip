# Skema Database — bpom_arsip_surat

Folder ini berisi migrasi SQL untuk aplikasi **Persuratan / Arsip Surat (ECIPAR POM)**.

> ⚠️ File `*.sql` di `data/` (root) adalah migrasi lama aplikasi **pemeliharaan_aset_bpom**
> yang sudah tidak terpakai. Jangan dijalankan ke `bpom_arsip_surat`.

## Cara pakai

Jalankan migrasi secara berurutan (urut nomor prefix):

```bash
# Dari root proyek
mysql -h 127.0.0.1 -P 3306 -u root < data/schema/001_create_database.sql
mysql -h 127.0.0.1 -P 3306 -u root bpom_arsip_surat < data/schema/002_xxx.sql
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
