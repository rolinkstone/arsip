// components/SessionSync.js
// Menyalin access token dari sesi NextAuth ke localStorage/sessionStorage,
// sehingga utils/axiosInstance.js (yang membaca key "token") otomatis
// mengirim Authorization: Bearer <accessToken> ke backend.
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function SessionSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.accessToken) {
      try {
        localStorage.setItem('token', session.accessToken);
        sessionStorage.setItem('token', session.accessToken);
      } catch (err) {
        // storage tidak tersedia — abaikan
      }
    }
  }, [session?.accessToken]);

  return null;
}
