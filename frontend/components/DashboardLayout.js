// components/DashboardLayout.js
/**
 * LAYOUT DASHBOARD — Template Aplikasi
 * -------------------------------------
 * Gaya: "zinc & amber" — ringan, bersih, mendukung DARK MODE (class "dark"
 * di <html>, tersimpan di localStorage key "theme").
 *
 * Struktur:
 *  - Sidebar kiri (zinc-900) + aksen amber, bisa di-minimize jadi ikon
 *  - Konten terang (stone-100 / putih) ↔ gelap (zinc-950 / zinc-900)
 *  - Top bar: toggle dark mode, toggle minimize, menu user
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import {
  FaBars, FaTimes, FaHome, FaSignOutAlt, FaChevronDown,
  FaChevronLeft, FaChevronRight, FaPlus, FaSun, FaMoon, FaArchive,
  FaFileSignature, FaBookOpen, FaCog, FaStamp, FaUserTie,
} from 'react-icons/fa';
import NotifikasiBell from './NotifikasiBell';
import { axiosInstance } from '../utils/axiosInstance';

// Jeda penyegaran notifikasi "perlu tindakan" (ms). Dipakai bersama oleh lonceng
// di top bar dan badge menu "Surat Tugas" — satu fetch untuk keduanya.
const POLL_NOTIF_MS = 60000;

// Menu dengan `children` = menu induk bersubmenu (bisa dibuka/ditutup).
// `adminOnly: true` pada submenu = hanya tampil untuk role admin_arsiparis
// (penjagaan sebenarnya tetap di backend).
const NAV_ITEMS = [
  { label: 'Beranda', href: '/', icon: FaHome },
  { label: 'Surat Tugas', href: '/surattugas', icon: FaFileSignature },
  {
    label: 'Pengaturan',
    icon: FaCog,
    children: [
      { label: 'Dasar Aturan', href: '/pengaturan/dasaraturan', icon: FaBookOpen },
      { label: 'Pejabat Penandatangan', href: '/pengaturan/pejabat', icon: FaUserTie, adminOnly: true },
      { label: 'Penomoran Manual', href: '/pengaturan/penomoran', icon: FaStamp, adminOnly: true },
    ],
  },
];

/** Apakah `href` sedang aktif untuk `pathname` sekarang? */
function cocokRute(pathname, href) {
  return (
    pathname === href ||
    (href !== '/' && pathname.startsWith(href + '/')) ||
    (href !== '/' && pathname === href.replace(/\/$/, ''))
  );
}

export default function DashboardLayout({ children, pageTitle = 'Beranda' }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const [sidebarOpen, setSidebarOpen] = useState(false); // khusus mobile
  const [isCollapsed, setIsCollapsed] = useState(false); // minimize sidebar (desktop)
  const [isDark, setIsDark] = useState(false); // dark mode
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // label menu induk yang submenunya terbuka
  const themeAppliedRef = useRef(false);
  const userMenuRef = useRef(null);

  // ===== Dark mode: inisialisasi dari localStorage / preferensi sistem =====
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    themeAppliedRef.current = true;
  }, []);

  // ===== Dark mode: terapkan saat berubah (lewati run pertama) =====
  useEffect(() => {
    if (!themeAppliedRef.current) return;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDark = () => setIsDark((v) => !v);

  // Redirect ke /login bila belum login
  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [loading, session, router]);

  // Tutup dropdown user saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Saat rute berubah: buka otomatis submenu yang memuat halaman aktif
  useEffect(() => {
    const induk = NAV_ITEMS.find((it) => it.children?.some((c) => cocokRute(router.pathname, c.href)));
    setOpenMenu(induk ? induk.label : null);
  }, [router.pathname]);

  // ==== Logout NextAuth + Keycloak SSO ====
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/login', redirect: false });
      const idToken = session?.idToken;
      const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
      const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'local-surat';
      const origin = window.location.origin;

      if (idToken && issuer) {
        const keycloakLogoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${origin}/login&client_id=${clientId}`;
        window.location.href = keycloakLogoutUrl;
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ==== Data user ====
  const user = session?.user || {};
  const displayName =
    user.name ||
    user.username ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Pengguna';
  const initials =
    displayName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  const roleLabel =
    typeof user.role === 'string' && user.role ? user.role : 'User';

  // ===== Notifikasi "perlu tindakan" (katim & admin_arsiparis) =====
  // Diambil SEKALI di sini lalu dipakai bersama: lonceng di top bar + badge menu
  // "Surat Tugas". Sumbernya data surat_tugas (lihat backend/routes/notifikasi.js),
  // jadi tidak perlu tabel notifikasi & tidak ada status "sudah dibaca".
  const adaAntreanPeran = !!(user.isKatim || user.isAdminArsiparis);
  const [notif, setNotif] = useState({ items: [], loading: false });

  const muatNotif = useCallback(async () => {
    try {
      setNotif((n) => ({ ...n, loading: true }));
      const res = await axiosInstance.get('/notifikasi');
      setNotif({ items: res.data?.data?.items || [], loading: false });
    } catch (e) {
      // Notifikasi bersifat pelengkap — jangan sampai mengganggu halaman.
      console.warn('Gagal memuat notifikasi:', e.response?.data?.message || e.message);
      setNotif((n) => ({ ...n, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!adaAntreanPeran) return undefined;
    muatNotif();
    const t = setInterval(muatNotif, POLL_NOTIF_MS);
    return () => clearInterval(t);
  }, [adaAntreanPeran, muatNotif]);

  // Segarkan lagi setiap pindah halaman (mis. selesai verifikasi ST).
  useEffect(() => {
    if (adaAntreanPeran) muatNotif();
  }, [router.pathname, adaAntreanPeran, muatNotif]);

  const jumlahNotif = notif.items.length;

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ================================================
  //  STATE LOADING
  // ================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-stone-400 dark:text-zinc-500 animate-pulse">Memuat…</div>
      </div>
    );
  }

  // Redirect akan terjadi via useEffect di atas
  if (!session) return null;

  const isActive = (href) => cocokRute(router.pathname, href);
  const isAdminArsiparis = !!user.isAdminArsiparis;

  return (
    <div className="min-h-screen bg-stone-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 flex flex-col transition-all duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'md:w-16' : 'md:w-64'}`}
      >
        {/* Brand */}
        <div
          className={`h-16 flex items-center border-b border-white/10 shrink-0 ${
            isCollapsed ? 'justify-center' : 'gap-3 px-5'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-amber-400 text-zinc-900 flex items-center justify-center text-base font-extrabold shadow-sm shrink-0">
            <FaArchive className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold leading-tight truncate">ECIPAR POM</p>
              <p className="text-[11px] text-zinc-500">Elektronik Cipta Arsip POM</p>
            </div>
          )}
        </div>

        {/* Navigasi */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
              Menu
            </p>
          )}
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const children = (item.children || []).filter((c) => !c.adminOnly || isAdminArsiparis);

              // ---- menu biasa (tanpa submenu) ----
              if (!children.length) {
                // Badge "perlu tindakan" hanya pada menu Surat Tugas.
                // Sidebar mengecil: cukup titik merah di pojok ikon.
                const badgeMenu = item.href === '/surattugas' && adaAntreanPeran ? jumlahNotif : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3.5 py-2.5'
                    } ${
                      isActive(item.href)
                        ? 'bg-amber-400 text-zinc-900'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                    {badgeMenu > 0 && (
                      isCollapsed ? (
                        <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500" />
                      ) : (
                        <span
                          className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center"
                          title={`${badgeMenu} surat tugas menunggu tindakan`}
                        >
                          {badgeMenu > 99 ? '99+' : badgeMenu}
                        </span>
                      )
                    )}
                  </Link>
                );
              }

              // ---- menu induk bersubmenu ----
              const adaAnakAktif = children.some((c) => isActive(c.href));
              const terbuka = openMenu === item.label;

              // Sidebar mengecil: cukup ikon; klik = lebarkan + buka submenu
              if (isCollapsed) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => { setIsCollapsed(false); setOpenMenu(item.label); }}
                    title={item.label}
                    aria-label={item.label}
                    className={`w-full flex items-center justify-center rounded-lg text-sm font-medium transition-colors px-0 py-2.5 ${
                      adaAnakAktif ? 'bg-amber-400 text-zinc-900' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </button>
                );
              }

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(terbuka ? null : item.label)}
                    aria-expanded={terbuka}
                    className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      adaAnakAktif && !terbuka
                        ? 'text-white bg-white/5'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <FaChevronDown className={`w-3 h-3 transition-transform ${terbuka ? 'rotate-180' : ''}`} />
                  </button>

                  {terbuka && (
                    <div className="mt-1 space-y-1 pl-3">
                      {children.map((c) => {
                        const IconAnak = c.icon;
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                              isActive(c.href)
                                ? 'bg-amber-400 text-zinc-900'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <IconAnak className="w-3.5 h-3.5 shrink-0" />
                            <span>{c.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* User (footer sidebar) */}
        <div className="px-3 py-3 border-t border-white/10 shrink-0">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-9 h-9 rounded-full bg-zinc-700 text-zinc-100 flex items-center justify-center text-xs font-semibold shrink-0"
                title={displayName}
              >
                {initials}
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Keluar"
                aria-label="Keluar"
                className="text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                <FaSignOutAlt className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-9 h-9 rounded-full bg-zinc-700 text-zinc-100 flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{displayName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{roleLabel}</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Keluar"
                aria-label="Keluar"
                className="text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              >
                <FaSignOutAlt className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= KONTEN ================= */}
      <div
        className={`flex flex-col min-h-screen transition-[padding] duration-300 ${
          isCollapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-stone-200 dark:bg-zinc-900/90 dark:border-zinc-800 flex items-center gap-2 sm:gap-4 px-4 sm:px-6 shrink-0">
          {/* Mobile: buka drawer */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            aria-label="Buka menu"
          >
            <FaBars className="w-5 h-5" />
          </button>

          {/* Desktop: minimize / perluas sidebar */}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="hidden md:inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 rounded-lg p-2 transition-colors"
            aria-label={isCollapsed ? 'Perluas menu samping' : 'Minimalkan menu samping'}
            title={isCollapsed ? 'Perluas menu' : 'Minimalkan menu'}
          >
            {isCollapsed ? (
              <FaChevronRight className="w-4 h-4" />
            ) : (
              <FaChevronLeft className="w-4 h-4" />
            )}
          </button>

          <div className="min-w-0">
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
              {pageTitle}
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:block">{today}</p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Notifikasi "perlu tindakan" (muncul hanya untuk katim & admin arsiparis) */}
            {adaAntreanPeran && <NotifikasiBell items={notif.items} loading={notif.loading} />}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="text-zinc-500 hover:text-zinc-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-amber-300 dark:hover:bg-zinc-800 rounded-lg p-2 transition-colors"
              aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
            >
              {isDark ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
            </button>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Menu pengguna"
              >
                <div className="w-8 h-8 rounded-full bg-amber-400 text-zinc-900 flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-tight truncate max-w-[160px]">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">
                    {roleLabel}
                  </p>
                </div>
                <FaChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-lg shadow-stone-200/60 dark:shadow-black/40 py-2 z-40">
                  <div className="px-4 py-2 border-b border-stone-100 dark:border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                      {user.email || roleLabel}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <FaSignOutAlt className="w-4 h-4" />
                    <span>{isLoggingOut ? 'Keluar…' : 'Keluar'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Konten halaman */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Tombol tutup sidebar (mobile, dalam aside) */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 left-[17rem] z-40 md:hidden text-zinc-400 hover:text-white transition-colors"
          aria-label="Tutup menu"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
