// pages/_document.js
// Menyuntikkan script tema lebih awal (di <head>) agar dark mode diterapkan
// SEBELUM halaman dicat, sehingga tidak ada kedipan (flash) warna terang/gelap.
import Document, { Html, Head, Main, NextScript } from 'next/document';

export default function MyDocument() {
  return (
    <Html lang="id">
      <Head>
        {/* Favicon aplikasi.
            • public/favicon.ico = ikon asli dari pengguna
            • public/icon.png    = PNG 256x256 (isi .ico, untuk browser modern & iOS)
            Param ?v=1 pada .ico dipakai agar browser yang sudah terlanjur
            men-cache 404 /favicon.ico (sebelum filenya ada) langsung mengambil
            ulang tanpa perlu membersihkan cache manual. */}
        <link rel="icon" href="/favicon.ico?v=1" sizes="any" />
        <link rel="icon" type="image/png" sizes="256x256" href="/icon.png" />
        <link rel="shortcut icon" href="/favicon.ico?v=1" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
