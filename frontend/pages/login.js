// pages/login.js
/**
 * HALAMAN LOGIN — ECIPAR POM
 * ---------------------------
 * ECIPAR POM = Elektronik Cipta Arsip POM
 * Desain selaras dengan dashboard ("zinc & amber"), mendukung dark mode
 * (class "dark" di <html>). Autentikasi via SSO Keycloak (NextAuth).
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import Head from 'next/head';
import { FaArchive, FaShieldAlt, FaUserLock, FaSpinner, FaLock } from 'react-icons/fa';

const features = [
  {
    icon: FaArchive,
    title: 'Arsip & Dokumen Digital',
    desc: 'Kelola surat dan arsip secara terpusat dalam satu sistem.',
  },
  {
    icon: FaShieldAlt,
    title: 'Aman & Terpercaya',
    desc: 'Dilindungi autentikasi SSO yang terintegrasi.',
  },
  {
    icon: FaUserLock,
    title: 'Akses Berbasis Peran',
    desc: 'Hak akses disesuaikan dengan peran pengguna.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pesan saat diarahkan ke sini karena sesi kedaluwarsa
  useEffect(() => {
    if (router.query.error === 'session_expired') {
      setError(
        'Sesi Anda telah berakhir karena token kedaluwarsa. Silakan masuk kembali menggunakan SSO.'
      );
    }
  }, [router.query.error]);

  const handleSSOLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signIn('keycloak', { callbackUrl: '/' });
    } catch (err) {
      setError('Gagal terhubung ke server SSO. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Masuk | ECIPAR POM</title>
        <meta
          name="description"
          content="ECIPAR POM — Elektronik Cipta Arsip POM. Silakan masuk menggunakan akun SSO."
        />
      </Head>

      {/* ================= LAYAR LOGIN ================= */}
      <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 bg-stone-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 overflow-hidden">
        {/* Dekorasi latar lembut */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 18%, rgba(245,158,11,0.12), transparent 45%), radial-gradient(circle at 88% 82%, rgba(245,158,11,0.10), transparent 45%)',
          }}
        />

        <div className="relative w-full max-w-5xl animate-in">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl shadow-xl shadow-stone-200/60 dark:shadow-black/30 overflow-hidden grid md:grid-cols-2">
            {/* ===== KIRI — BRAND PANEL ===== */}
            <div className="bg-zinc-900 dark:bg-zinc-950 text-white relative overflow-hidden p-8 sm:p-10 flex flex-col">
              {/* Dekorasi */}
              <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-10 w-64 h-64 rounded-full bg-white/5 blur-2xl" />

              <div className="relative">
                {/* Logo + nama */}
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <FaArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold tracking-tight">ECIPAR POM</p>
                    <p className="text-[11px] text-zinc-400 tracking-wide uppercase">
                      Elektronik Cipta Arsip POM
                    </p>
                  </div>
                </div>

                {/* Headline */}
                <h2 className="mt-10 text-2xl sm:text-[1.7rem] font-bold leading-snug">
                  Kelola arsip POM
                  <br />
                  <span className="text-amber-400">secara digital & aman.</span>
                </h2>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                  Satu pintu untuk menyimpan, mencari, dan mengelola arsip surat
                  lingkungan POM dengan akses yang terkontrol.
                </p>

                {/* Fitur unggulan */}
                <div className="mt-9 space-y-5">
                  {features.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.title} className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{f.title}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer brand */}
                <div className="mt-auto pt-10">
                  <div className="border-t border-white/10 pt-5">
                    <p className="text-xs text-zinc-500">
                      © {new Date().getFullYear()} ECIPAR POM
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Elektronik Cipta Arsip POM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== KANAN — FORM LOGIN ===== */}
            <div className="p-8 sm:p-10 bg-white dark:bg-zinc-900 flex items-center">
              <div className="w-full max-w-sm mx-auto animate-in-delay-1">
                {/* Judul */}
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  Selamat Datang
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                  Masuk menggunakan akun SSO POM untuk mengakses <span className="font-semibold text-zinc-700 dark:text-zinc-300">ECIPAR POM</span>.
                </p>

                {/* Error */}
                {error && (
                  <div className="mt-6 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Tombol SSO */}
                <button
                  onClick={handleSSOLogin}
                  disabled={isLoading}
                  className="mt-8 w-full inline-flex items-center justify-center gap-3 rounded-xl bg-amber-400 text-zinc-900 font-semibold px-6 py-3.5 text-sm hover:bg-amber-300 active:scale-[0.99] transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    <FaLock className="w-4 h-4" />
                  )}
                  <span>{isLoading ? 'Mengarahkan ke SSO…' : 'Masuk dengan SSO POM'}</span>
                </button>

                {/* Catatan */}
                <p className="mt-4 text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                  Anda akan diarahkan ke halaman autentikasi terpusat (SSO) untuk
                  memverifikasi identitas.
                </p>

                {/* Info sistem */}
                <div className="mt-8 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950/50 divide-y divide-stone-200 dark:divide-zinc-800">
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Status Sistem</span>
                    <span className="inline-flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Aktif
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Autentikasi</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">SSO POM</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Versi</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">v1.0.0</span>
                  </div>
                </div>

                {/* Bantuan */}
                <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  Butuh bantuan? Hubungi administrator sistem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
