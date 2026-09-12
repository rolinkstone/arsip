// components/ContainerPengembangan.js
// Placeholder untuk modul yang BELUM selesai.
// Dipakai oleh menu "Nota Dinas" & "Surat Dinas" supaya judul menu sudah
// tampil di sidebar, sementara isi halamannya masih dalam pengembangan.
import { FaTools } from 'react-icons/fa';

export default function ContainerPengembangan({ judul, deskripsi, icon: Icon = FaTools }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15 text-amber-500">
            <Icon className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            {judul}
          </h2>

          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-400">
            <FaTools className="h-3 w-3" /> Dalam Pengembangan
          </span>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-500 dark:text-zinc-400">
            {deskripsi ||
              `Modul ${judul} belum tersedia. Halaman ini masih dalam proses pengerjaan.`}
          </p>
        </div>
      </div>
    </div>
  );
}
