-- ============================================================
-- ECIPAR POM — Persuratan (Arsip Surat)
-- Database: bpom_arsip_surat
-- Migrasi 001: Pastikan database tersedia (idempotent)
--
-- Jalankan dari root proyek:
--   mysql -h 127.0.0.1 -P 3306 -u root < data/schema/001_create_database.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS bpom_arsip_surat
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bpom_arsip_surat;
