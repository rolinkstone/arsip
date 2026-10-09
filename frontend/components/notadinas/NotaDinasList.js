// components/notadinas/NotaDinasList.js — Daftar Nota Dinas (sesuai role)
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import { tglIndo, statusMeta } from '../../utils/suratFormat';
import {
  FaPlus, FaSearch, FaEye, FaRegStickyNote, FaUserShield, FaStamp,
} from 'react-icons/fa';

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'diajukan', label: 'Menunggu Verifikasi' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'dikembalikan', label: 'Dikembalikan' },
  { value: 'terbit', label: 'Terbit' },
];

export default function NotaDinasList() {
  const { data: session, status: sessionStatus } = useSession();

  const user = session?.user || {};
  const isKatim = !!user.isKatim;
  const isAdminArsiparis = !!user.isAdminArsiparis;
  // Siapa pun yang sudah login boleh membuat Nota Dinas. Yang dibedakan peran
  // hanya ANTREAN TUGAS: verifikasi (katim) dan penomoran (admin_arsiparis).
  const canCreate = true;

  const [list, setList] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { status: statusFilter };
      if (q.trim()) params.q = q.trim();
      const res = await axiosInstance.get('/notadinas', { params });
      setList(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q]);

  const loadStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/notadinas/stats');
      setStats(res.data?.data || {});
    } catch (e) { /* abaikan — ringkasan hanya pelengkap */ }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') loadStats();
  }, [sessionStatus, loadStats]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') load();
  }, [sessionStatus, load, statusFilter]);

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-[60vh] text-stone-400 dark:text-zinc-500 flex items-center justify-center text-sm animate-pulse">
        Memuat…
      </div>
    );
  }

  // Untuk katim, kartu "Menunggu Verifikasi" menampilkan ANTREAN yang ditujukan
  // kepadanya; untuk peran lain, jumlah ND berstatus diajukan yang terlihat.
  const badgeDiajukan = isKatim ? stats.menunggu_verifikasi || 0 : stats.diajukan || 0;
  const badgeDisetujui = isAdminArsiparis ? stats.menunggu_penomoran || 0 : stats.disetujui || 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center">
            <FaRegStickyNote className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Nota Dinas</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Buat, verifikasi, dan terbitkan penomoran nota dinas
            </p>
          </div>
        </div>
        {canCreate && (
          <Link
            href="/notadinas?mode=tambah"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-900 text-sm font-semibold hover:bg-amber-300 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Buat Nota Dinas
          </Link>
        )}
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Draft', value: stats.draft || 0, go: 'draft' },
          { label: isKatim ? 'Menunggu Verifikasi' : 'Diajukan', value: badgeDiajukan, go: 'diajukan' },
          { label: isAdminArsiparis ? 'Siap Dinomori' : 'Disetujui', value: badgeDisetujui, go: 'disetujui' },
          { label: 'Terbit', value: stats.terbit || 0, go: 'terbit' },
        ].map((s) => (
          <button
            key={s.go}
            onClick={() => setStatusFilter(statusFilter === s.go ? 'all' : s.go)}
            className={`text-left rounded-xl border p-4 transition-colors ${
              statusFilter === s.go
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-amber-300'
            }`}
          >
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
            <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter + cari */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
            placeholder="Cari hal / nomor / tujuan / pengirim…"
            className="w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <button
          onClick={load}
          className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          Cari
        </button>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-10 text-center text-sm text-zinc-400 animate-pulse">
          Memuat data…
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-6 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-700 p-10 text-center">
          <FaRegStickyNote className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Belum ada nota dinas. {canCreate ? 'Klik "Buat Nota Dinas" untuk memulai.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const meta = statusMeta(item.status);
            const isMine = !session?.user?.id || item.user_key === session.user.id;
            return (
              <div
                key={item.id}
                className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">#{item.id}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {item.hal || '(tanpa hal)'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      Nomor: <b className="text-zinc-700 dark:text-zinc-200">{item.nomor_nd || '—'}</b>
                    </span>
                    <span>Tanggal: {tglIndo(item.tanggal_nd)}</span>
                    <span>Lampiran: {item.lampiran || '-'}</span>
                    {item.kepada && <span className="truncate max-w-[16rem]">Yth: {item.kepada}</span>}
                    {!isMine && item.username && <span>Dibuat oleh: {item.username}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/notadinas?id=${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-stone-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-stone-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <FaEye className="w-3.5 h-3.5" />
                    Detail
                  </Link>
                  {item.status === 'diajukan' && isKatim && (
                    <Link href={`/notadinas?id=${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-amber-400 text-zinc-900 hover:bg-amber-300">
                      <FaUserShield className="w-3.5 h-3.5" /> Verifikasi
                    </Link>
                  )}
                  {item.status === 'disetujui' && isAdminArsiparis && (
                    <Link href={`/notadinas?id=${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-blue-500 text-white hover:bg-blue-400">
                      <FaStamp className="w-3.5 h-3.5" /> Penomoran
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
