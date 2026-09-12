// pages/pengaturan/index.js
// Halaman lama "/pengaturan" kini DIRELOKASI:
//   • /pengaturan/dasaraturan  → Dasar Aturan (isi lama)
//   • /pengaturan/pejabat      → Pejabat Penandatangan / nama Kepala Balai (khusus admin arsiparis)
//   • /pengaturan/penomoran    → Penomoran Manual (khusus admin arsiparis)
// File ini hanya mengalihkan agar tautan/bookmark lama tetap berfungsi.
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FaSpinner } from 'react-icons/fa';

export default function PengaturanRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pengaturan/dasaraturan');
  }, [router]);

  return (
    <>
      <Head><title>Pengaturan | ECIPAR POM</title></Head>
      <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex items-center justify-center gap-2 text-sm text-zinc-400">
        <FaSpinner className="w-4 h-4 animate-spin" /> Mengalihkan ke Pengaturan…
      </div>
    </>
  );
}
