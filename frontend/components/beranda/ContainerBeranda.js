// components/beranda/ContainerBeranda.js
// Logic halaman Beranda (dashboard) — dirender oleh pages/index.js
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaFileSignature, FaArrowRight, FaUserShield, FaStamp, FaCheckCircle, FaPlus, FaBookOpen } from 'react-icons/fa';
import { statusMeta, tglIndo } from '../../utils/suratFormat';

const greetings = [
  { text: 'Selamat pagi', range: [0, 10] },
  { text: 'Selamat siang', range: [10, 15] },
  { text: 'Selamat sore', range: [15, 18] },
  { text: 'Selamat malam', range: [18, 24] },
];

const getGreeting = () => {
  const h = new Date().getHours();
  return greetings.find((g) => h >= g.range[0] && h < g.range[1]) || greetings[0];
};

export default function ContainerBeranda() {
  const { data: session, status } = useSession();
  const [greeting, setGreeting] = useState('');
  const [dash, setDash] = useState(null);

  useEffect(() => {
    setGreeting(getGreeting().text);
    const interval = setInterval(() => setGreeting(getGreeting().text), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      axiosInstance
        .get('/surattugas/dashboard')
        .then((r) => setDash(r.data?.data || {}))
        .catch(() => {});
    }
  }, [status]);

  const loading = status === 'loading';
  const user = session?.user || {};
  const displayName =
    user.name ||
    user.username ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Pengguna';
  const roleLabel = typeof user.role === 'string' && user.role ? user.role : 'User';
  const isKatim = !!user.isKatim;
  const isAdminArsiparis = !!user.isAdminArsiparis;
  const isUser = !isKatim && !isAdminArsiparis;

  const counts = dash?.counts || {};
  const recent = dash?.recent || [];
  const trend = dash?.trend || [];
  const trendMax = Math.max(1, ...trend.map((t) => t.total || 0));

  const cards = isKatim
    ? [
        { key: 'diajukan', label: 'Menunggu Verifikasi', value: counts.diajukan || 0, icon: FaUserShield, to: '/surattugas' },
        { key: 'disetujui', label: 'Disetujui', value: counts.disetujui || 0, icon: FaCheckCircle, to: '/surattugas' },
        { key: 'terbit', label: 'Terbit', value: counts.terbit || 0, icon: FaFileSignature, to: '/surattugas' },
      ]
    : isAdminArsiparis
    ? [
        { key: 'disetujui', label: 'Menunggu Penomoran', value: counts.disetujui || 0, icon: FaStamp, to: '/surattugas' },
        { key: 'terbit', label: 'Terbit', value: counts.terbit || 0, icon: FaFileSignature, to: '/surattugas' },
      ]
    : [
        { key: 'draft', label: 'Draft', value: counts.draft || 0, icon: FaFileSignature, to: '/surattugas' },
        { key: 'diajukan', label: 'Menunggu Verifikasi', value: counts.diajukan || 0, icon: FaUserShield, to: '/surattugas' },
        { key: 'disetujui', label: 'Disetujui', value: counts.disetujui || 0, icon: FaCheckCircle, to: '/surattugas' },
        { key: 'terbit', label: 'Terbit', value: counts.terbit || 0, icon: FaFileSignature, to: '/surattugas' },
      ];

  const allFlow = [
    { key: 'draft', label: 'Draft', count: counts.draft || 0, desc: 'Dibuat oleh user' },
    { key: 'diajukan', label: 'Diajukan', count: counts.diajukan || 0, desc: 'Menunggu verifikasi katim' },
    { key: 'disetujui', label: 'Disetujui', count: counts.disetujui || 0, desc: 'Siap diberi nomor' },
    { key: 'terbit', label: 'Terbit', count: counts.terbit || 0, desc: 'Nomor ST diterbitkan' },
  ];
  const flowSteps = isKatim
    ? allFlow.filter((s) => s.key !== 'draft')
    : isAdminArsiparis
    ? allFlow.filter((s) => s.key === 'disetujui' || s.key === 'terbit')
    : allFlow;

  if (loading) {
    return (
      <div className="min-h-[60vh] text-zinc-800 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-stone-400 dark:text-zinc-500 animate-pulse">Memuat…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===== Sapaan ===== */}
      <section className="bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-amber-400 flex items-center justify-center text-zinc-900 text-xl font-extrabold shrink-0">
          {displayName
            .split(' ')
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'U'}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {greeting}, {displayName}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Selamat datang di aplikasi Persuratan ({roleLabel}). Kelola Surat
            Tugas &amp; SPPD — dibuat pegawai, diverifikasi katim, lalu dinomori
            admin arsiparis.
          </p>
        </div>
      </section>

      {/* ===== Ringkasan ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            Ringkasan Surat Tugas
          </h2>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            modul Persuratan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.label}
                href="/surattugas"
                className="bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 p-5 flex items-center justify-between gap-3 min-h-[96px] hover:border-amber-300 transition-colors group"
              >
                <div>
                  <p className="text-[13px] font-medium text-stone-500 dark:text-stone-400">
                    {c.label}
                  </p>
                  <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                    {c.value}
                  </p>
                </div>
                <Icon className="w-6 h-6 text-stone-300 dark:text-zinc-700 group-hover:text-amber-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ===== Alur Workflow ===== */}
      <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            Alur Surat Tugas
          </h2>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">draft → diajukan → disetujui → terbit</span>
        </div>
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          {flowSteps.map((s, i) => (
            <div key={s.key} className="flex items-start gap-3 shrink-0">
              <div className="min-w-[170px]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      s.key === 'draft'
                        ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                        : s.key === 'diajukan'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : s.key === 'disetujui'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {s.count}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.label}</p>
                    <p className="text-[11px] text-zinc-400">{s.desc}</p>
                  </div>
                </div>
              </div>
              {i < flowSteps.length - 1 && (
                <div className="flex items-center mt-2 text-zinc-300 dark:text-zinc-700">
                  <FaArrowRight className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== Tren & Terbaru ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <section className="lg:col-span-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            Tren Surat (6 bulan)
          </h2>
          <div className="flex items-end justify-between gap-3 h-36 mt-4">
            {trend.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{m.total || ''}</span>
                <div
                  title={`${m.label}: ${m.total}`}
                  className="w-full max-w-[38px] rounded-t-md bg-gradient-to-t from-amber-500 to-amber-300 hover:from-amber-600 hover:to-amber-400 transition-all"
                  style={{ height: `${Math.max(6, Math.round((m.total / trendMax) * 80))}px` }}
                />
                <span className="text-[10px] text-zinc-400">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-3 rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              Surat Tugas Terbaru
            </h2>
            <Link href="/surattugas" className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline">
              Lihat semua <FaArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">Belum ada surat tugas.</div>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-zinc-800">
              {recent.map((it) => {
                const meta = statusMeta(it.status);
                return (
                  <li key={it.id}>
                    <Link href={`/surattugas?id=${it.id}`} className="group flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate group-hover:text-amber-600 transition-colors">
                          {it.kegiatan || '(tanpa kegiatan)'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          #{it.id} · {tglIndo(it.tanggal_st)}
                          {it.nomor_st ? ` · ${it.nomor_st}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ===== Aksi Cepat ===== */}
      <section className="rounded-xl p-5 sm:p-6 bg-gradient-to-br from-stone-100 to-amber-50 dark:from-zinc-900 dark:to-zinc-900 border border-stone-200 dark:border-zinc-800">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500 mb-3">
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isUser && (
            <Link href="/surattugas?mode=tambah" className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:border-amber-400 hover:text-amber-600 transition-colors">
              <span className="w-8 h-8 rounded-lg bg-amber-400 text-zinc-900 flex items-center justify-center shrink-0"><FaPlus className="w-4 h-4" /></span>
              Buat Surat Tugas
            </Link>
          )}
          <Link href="/surattugas" className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:border-amber-400 hover:text-amber-600 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0"><FaFileSignature className="w-4 h-4" /></span>
            Buka Surat Tugas
          </Link>
          <Link href="/pengaturan" className="flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:border-amber-400 hover:text-amber-600 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-stone-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0"><FaBookOpen className="w-4 h-4" /></span>
            Dasar Aturan
          </Link>
        </div>
      </section>
    </div>
  );
}
