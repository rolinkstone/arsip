// utils/suratFormat.js — format & meta untuk modul Surat Tugas/SPPD

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// 'YYYY-MM-DD' | Date -> '09 September 2026'
export function tglIndo(dateStr) {
  if (!dateStr) return '-';
  const d = dateStr instanceof Date ? dateStr : new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// 'YYYY-MM-DD' | Date -> '09/09/2026'
export function tglSlash(dateStr) {
  if (!dateStr) return '-';
  const d = dateStr instanceof Date ? dateStr : new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export const STATUS_META = {
  draft: {
    label: 'Draft',
    dot: 'bg-zinc-400',
    cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  },
  diajukan: {
    label: 'Menunggu Verifikasi',
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
  disetujui: {
    label: 'Disetujui / Siap Nomor',
    dot: 'bg-blue-500',
    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  },
  dikembalikan: {
    label: 'Dikembalikan',
    dot: 'bg-red-500',
    cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  },
  terbit: {
    label: 'Terbit',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || '-', dot: 'bg-zinc-400', cls: 'bg-zinc-100 text-zinc-600' };
}

export const TINGKAT_BIAYA = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
];

export const ALAT_ANGKUT = [
  { value: 'udara', label: 'Angkutan Udara' },
  { value: 'darat', label: 'Angkutan Darat' },
];
