// pages/404.js
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Halaman Tidak Ditemukan</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-10 text-center shadow-sm dark:shadow-black/20">
          <p className="text-6xl font-extrabold text-zinc-200 dark:text-zinc-700 leading-none">
            404
          </p>
          <h1 className="mt-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Halaman tidak ditemukan
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Halaman yang Anda cari mungkin telah dihapus, dipindahkan, atau tidak
            pernah ada.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg bg-zinc-900 dark:bg-amber-400 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-amber-300 transition-colors"
          >
            <FaArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </>
  );
}
