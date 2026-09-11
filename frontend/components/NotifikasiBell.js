// ============================================================
// LONCENG NOTIFIKASI "PERLU TINDAKAN" (top bar)
//
// Komponen ini TAMPILAN SAJA — data notifikasinya diambil oleh DashboardLayout
// (satu kali fetch, dipakai bersama badge menu "Surat Tugas") supaya tidak ada
// dua permintaan ke API untuk data yang sama.
//
// Sumber data: GET /api/notifikasi — DIHITUNG dari tabel surat_tugas, bukan dari
// tabel notifikasi terpisah. Jadi isinya selalu keadaan terkini dan notifikasi
// hilang sendiri begitu ST-nya diverifikasi (katim) atau diberi nomor ST
// (admin arsiparis) — tidak perlu tombol "tandai sudah dibaca".
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { FaBell, FaStamp, FaCheckDouble, FaCircleNotch } from 'react-icons/fa';

const JENIS_META = {
  verifikasi: {
    icon: FaCheckDouble,
    label: 'Menunggu verifikasi',
    kelas: 'text-amber-600 dark:text-amber-400',
  },
  penomoran: {
    icon: FaStamp,
    label: 'Menunggu nomor ST',
    kelas: 'text-emerald-600 dark:text-emerald-400',
  },
};

/**
 * @param {Array}  items   daftar notifikasi dari GET /api/notifikasi
 * @param {boolean} loading true saat sedang menyegarkan daftar
 */
export default function NotifikasiBell({ items = [], loading = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Tutup panel saat klik di luar
  useEffect(() => {
    const onKlikLuar = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onKlikLuar);
    return () => document.removeEventListener('mousedown', onKlikLuar);
  }, []);

  const jumlah = items.length;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-zinc-500 hover:text-zinc-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-amber-300 dark:hover:bg-zinc-800 rounded-lg p-2 transition-colors"
        aria-label={`Notifikasi${jumlah ? ` (${jumlah} perlu tindakan)` : ''}`}
        title={jumlah ? `${jumlah} surat tugas menunggu tindakan` : 'Tidak ada yang menunggu tindakan'}
      >
        <FaBell className="w-4 h-4" />
        {jumlah > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
            {jumlah > 99 ? '99+' : jumlah}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] sm:w-[360px] max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-zinc-800">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Perlu tindakan</p>
            {loading
              ? <FaCircleNotch className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              : <span className="text-xs text-zinc-400 dark:text-zinc-500">{jumlah}</span>}
          </div>

          {jumlah === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-zinc-400 dark:text-zinc-500">
              Tidak ada surat tugas yang menunggu tindakan Anda.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-zinc-800">
              {items.map((it) => {
                const meta = JENIS_META[it.jenis] || JENIS_META.verifikasi;
                const Icon = meta.icon;
                return (
                  <li key={`${it.jenis}-${it.id}`}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); router.push(it.url); }}
                      className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition-colors flex gap-3"
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.kelas}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {meta.label} · ST #{it.id}{it.nomor_st ? ` · ${it.nomor_st}` : ''}
                        </span>
                        <span className="block text-sm text-zinc-800 dark:text-zinc-100 leading-snug mt-0.5">
                          {it.pesan}
                        </span>
                        {it.catatan ? (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{it.catatan}</span>
                        ) : null}
                        {it.waktuTeks ? (
                          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{it.waktuTeks}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => { setOpen(false); router.push('/surattugas'); }}
            className="w-full px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-stone-50 dark:hover:bg-zinc-800/60 border-t border-stone-200 dark:border-zinc-800 transition-colors"
          >
            Buka daftar Surat Tugas
          </button>
        </div>
      )}
    </div>
  );
}
