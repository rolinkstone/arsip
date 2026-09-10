// utils/authInterceptor.js
/**
 * INTERCEPTOR AUTENTIKASI GLOBAL (Axios + fetch)
 * ----------------------------------------------------------------
 * Mendeteksi response autentikasi yang gagal lalu otomatis melakukan
 * sign-out dan redirect ke halaman /login, sehingga pengguna TIDAK
 * tertahan di halaman terproteksi dengan konten kosong (empty state)
 * saat token kedaluwarsa ("Token invalid or expired").
 *
 * Aturan:
 * - 401 (Unauthorized)  -> token invalid/expired/sesi hilang => redirect ke /login.
 * - 403 (Forbidden)     -> di aplikasi ini umumnya penolakan BERDASARKAN PERAN
 *                          (code 'FORBIDDEN' / "Akses ditolak"). Pengguna TIDAK
 *                          boleh di-logout karena itu, jadi 403 hanya diproses bila
 *                          body response menandakan masalah sesi (bukan FORBIDDEN).
 *
 * Cara kerja:
 * - Axios : semua modul memakai `import axios from 'axios'` (instance default
 *           yang sama), jadi cukup pasang interceptor 1x di sini.
 * - fetch : beberapa modul (mis. laporanrusak) memakai fetch API polos,
 *           jadi `window.fetch` dibungkus untuk mendeteksi 401.
 */
import axios from 'axios';
import { signOut } from 'next-auth/react';

// Mencegah redirect ganda saat banyak request gagal paralel.
let isHandlingAuthFailure = false;

const isBrowser = () => typeof window !== 'undefined';

/**
 * Menentukan apakah sebuah kegagalan HTTP merupakan kegagalan SESI
 * (token invalid/expired) yang mengharuskan redirect ke login.
 * @param {number} status  Kode status HTTP.
 * @param {object} [body]  Body response (dari axios) bila tersedia.
 */
export const isSessionFailure = (status, body) => {
  if (status === 401) return true;

  // 403 umumnya "Akses ditolak" berbasis peran (code FORBIDDEN) -> jangan logout.
  if (status === 403) {
    // Defensif: bila body menandakan masalah autentikasi (bukan FORBIDDEN),
    // perlakukan sebagai kegagalan sesi.
    const code = body?.code;
    const message = (body?.message || '').toLowerCase();
    if (code === 'FORBIDDEN' || message.includes('akses ditolak')) return false;
    return /token|unauthorized|expired|login|session/i.test(message);
  }

  return false;
};

/**
 * Endpoint/URL yang TIDAK boleh memicu redirect saat 401/403.
 */
const shouldSkipAuthRedirect = (requestUrl = '') => {
  if (!isBrowser()) return true;

  const url = requestUrl || '';
  // Endpoint login/auth backend (mis. salah password -> 401, jangan redirect)
  if (url.includes('/api/login') || url.includes('/api/auth')) return true;

  // Permintaan internal Next.js (data route, asset, dll.)
  if (url.includes('/_next') || url.includes('__next')) return true;

  // Sudah berada di halaman login -> hindari loop redirect
  const path = window.location.pathname || '';
  if (path.startsWith('/login')) return true;

  return false;
};

/**
 * Aksi inti saat autentikasi gagal: bersihkan token lokal,
 * sign-out sesi NextAuth (+ Keycloak SSO via events.signOut),
 * lalu arahkan ke /login dengan penanda sesi berakhir.
 */
export const handleAuthFailure = () => {
  if (!isBrowser()) return;
  if (isHandlingAuthFailure) return;
  isHandlingAuthFailure = true;

  const resetGuard = () =>
    setTimeout(() => {
      isHandlingAuthFailure = false;
    }, 5000);

  try {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  } catch (err) {
    // storage tidak tersedia — abaikan
  }

  const target = `${window.location.origin}/login?error=session_expired`;

  console.warn('[auth-interceptor] Sesi tidak valid/kedaluwarsa → redirect ke /login');

  // signOut({ redirect:true }) membersihkan cookie sesi NextAuth dan
  // memicu events.signOut di [...nextauth].js (logout Keycloak SSO),
  // lalu mengarahkan ke callbackUrl.
  signOut({ redirect: true, callbackUrl: target })
    .catch(() => {
      // Fallback bila panggilan sign-out gagal (offline, dll.)
      window.location.href = target;
    })
    .finally(resetGuard);
};

// ----------------------------------------------------------------------
// 1) INTERCEPTOR AXIOS — dipasang pada instance default axios
// ----------------------------------------------------------------------
let axiosInterceptorInstalled = false;
const installAxiosInterceptor = () => {
  if (axiosInterceptorInstalled) return;
  axiosInterceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        const requestUrl = error?.config?.url || '';
        const responseBody = error?.response?.data;
        if (!shouldSkipAuthRedirect(requestUrl) && isSessionFailure(status, responseBody)) {
          handleAuthFailure();
        }
      }
      return Promise.reject(error);
    }
  );
};

// ----------------------------------------------------------------------
// 2) INTERCEPTOR FETCH — bungkus window.fetch (deteksi 401)
// ----------------------------------------------------------------------
let fetchInterceptorInstalled = false;
const installFetchInterceptor = () => {
  if (!isBrowser() || fetchInterceptorInstalled) return;
  fetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    // Catatan: body tidak dibaca di sini agar tidak mengonsumsi stream
    // yang masih dibutuhkan pemanggil. 401 sudah cukup mewakili sesi gagal.
    if (response.status === 401) {
      const requestUrl =
        typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (!shouldSkipAuthRedirect(requestUrl)) {
        handleAuthFailure();
      }
    }
    return response;
  };
};

export const installAuthInterceptor = () => {
  installAxiosInterceptor();
  installFetchInterceptor();
};

// Auto-install saat modul pertama kali dimuat di browser.
installAuthInterceptor();
