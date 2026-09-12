// components/pengaturan/ContainerPejabat.js
// Logic modul "Pengaturan — Pejabat Penandatangan" (nama Kepala Balai).
//
// MASALAH YANG DISELESAIKAN:
//   Nama Kepala Balai pada cetak Surat Tugas, halaman lampiran, dan SPD/SPPD
//   dulu DI-HARDCODE di kode (konstanta TTD_KEPALA_NAMA pada CetakSuratTugas.js
//   & CetakSPD.js) — jadi setiap ganti pimpinan harus ubah kode + build ulang.
//
//   Sekarang nama disimpan sekali di tabel app_setting (kunci `ttd_kepala_nama`)
//   dan dibaca oleh:
//     • halaman ini (GET /api/pejabat)
//     • GET /api/surattugas/:id → field `ttd_kepala_nama` (dipakai ketiga
//       komponen cetak: DokumenST, LampiranPeserta, DokumenSPD)
//   Jadi ubah di sini → SEMUA cetak ST, lampiran, dan SPD langsung ikut.
//
// Halaman ini KHUSUS admin arsiparis. Penjagaan sebenarnya ada di backend
// (routes/pejabat.js → hanyaAdmin); di sini hanya menampilkan penolakan.
import { useCallback, useEffect, useState } from 'react';
import { axiosInstance } from '../../utils/axiosInstance';
import {
  FaInfoCircle, FaLock, FaSave, FaSpinner, FaUserTie, FaSyncAlt,
} from 'react-icons/fa';

const inputCls =
  'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

// Nama bawaan yang dipakai komponen cetak bila setting belum pernah diisi.
// (harus sama dengan konstanta TTD_KEPALA_NAMA di CetakSuratTugas.js & CetakSPD.js)
const NAMA_BAWAAN = 'Ali Yudhi Hartanto, SF., Apt., MM';

export default function ContainerPejabat({ session, status }) {
  const isAdmin = !!session?.user?.isAdminArsiparis;

  const [nama, setNama] = useState('');
  const [namaTersimpan, setNamaTersimpan] = useState('');
  const [maksPanjang, setMaksPanjang] = useState(150);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setPesan('');
    try {
      const res = await axiosInstance.get('/pejabat');
      const d = res.data?.data || {};
      setNama(d.kepala_nama || '');
      setNamaTersimpan(d.kepala_nama || '');
      if (d.maks_panjang) setMaksPanjang(d.maks_panjang);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat nama pejabat penandatangan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return;
    load();
  }, [status, isAdmin, load]);

  const simpan = async () => {
    setSaving(true);
    setError('');
    setPesan('');
    try {
      const res = await axiosInstance.put('/pejabat', { kepalaNama: nama });
      const d = res.data?.data || {};
      setNama(d.kepala_nama ?? nama);
      setNamaTersimpan(d.kepala_nama ?? nama);
      setPesan(res.data?.message || 'Nama Kepala Balai disimpan.');
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan nama Kepala Balai');
    } finally {
      setSaving(false);
    }
  };

  // ---------- tampilan: sedang memuat sesi ----------
  if (status === 'loading') {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-400 animate-pulse">
        Memuat…
      </div>
    );
  }

  // ---------- tampilan: bukan admin ----------
  if (!isAdmin) {
    return (
      <div className="max-w-2xl rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <FaLock className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Akses ditolak</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Halaman Pejabat Penandatangan hanya dapat dibuka oleh <b>Admin Arsiparis</b>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const belumDiatur = !namaTersimpan;
  const berubah = nama.trim() !== namaTersimpan;
  const namaBerlaku = namaTersimpan || NAMA_BAWAAN;

  return (
    <div className="max-w-3xl space-y-5">
      {/* ===== Keterangan ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FaUserTie className="w-4 h-4" />
          </span>
          <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Nama pejabat penandatangan</h3>
            <p>
              Nama ini menjadi <b>default</b> yang otomatis terisi saat <b>membuat Surat Tugas baru</b>,
              dan tercetak sebagai penanda tangan <b>Kepala Balai</b> pada:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li><b>Surat Tugas</b> (kolom tanda tangan)</li>
              <li><b>Lampiran daftar nama peserta</b></li>
              <li><b>SPD / SPPD</b> (halaman belakang)</li>
            </ul>
            <p>
              Nama juga <b>tersimpan pada masing-masing Surat Tugas</b>. Jadi saat pimpinan berganti,
              cukup ubah di sini: ST yang dibuat setelahnya memakai nama baru, sedangkan
              <b> ST yang sudah dibuat/terbit tetap memakai nama lama</b>.
            </p>
          </div>
        </div>
      </div>

      {/* ===== Form ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Nama Kepala Balai (default ST baru)</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Tulis lengkap dengan gelar, persis seperti yang harus tercetak pada surat.
        </p>

        {loading ? (
          <div className="py-6 flex items-center gap-2 text-sm text-zinc-400">
            <FaSpinner className="w-4 h-4 animate-spin" /> Memuat…
          </div>
        ) : (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-500 mb-1">
                Nama &amp; gelar ({maksPanjang} karakter maksimal)
              </span>
              <input
                type="text"
                value={nama}
                maxLength={maksPanjang}
                onChange={(e) => setNama(e.target.value)}
                placeholder={NAMA_BAWAAN}
                className={inputCls}
              />
            </label>

            {belumDiatur && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                Belum pernah diatur — cetak saat ini masih memakai nama bawaan: <b>{NAMA_BAWAAN}</b>.
              </p>
            )}
            {!belumDiatur && berubah && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                Belum disimpan. Klik <b>Simpan</b> agar cetak memakai nama yang baru.
              </p>
            )}

            {/* Contoh yang akan tercetak */}
            <div className="mt-4 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                Contoh yang akan tercetak:
              </p>
              <p className="text-sm text-zinc-800 dark:text-zinc-100 leading-relaxed">
                Kepala Balai Besar POM Di Palangka Raya,
                <br />
                <span className="text-zinc-400 dark:text-zinc-500">{'${ttd_pengirim}'}</span>
                <br />
                <b>{nama.trim() || namaBerlaku}</b>
              </p>
            </div>

            {/* Pesan / error */}
            {pesan && (
              <p className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm px-4 py-2.5">
                {pesan}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 text-sm px-4 py-2.5">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={simpan}
                disabled={saving || !nama.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
                Simpan
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                <FaSyncAlt className="w-3.5 h-3.5" /> Muat ulang
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Catatan ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <FaInfoCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              Mengubah nama di sini <b>tidak mengubah Surat Tugas yang sudah dibuat</b> — dokumen
              itu tetap memakai nama yang tersimpan padanya.
            </p>
            <p>
              Nama untuk ST tertentu masih bisa diganti saat membuat/mengedit ST, pada kolom
              <b> “Nama Kepala Balai (penandatangan)”</b> di bagian <b>3. Data Surat Tugas</b>.
            </p>
            <p>
              Yang diatur di sini hanya <b>nama penanda tangan</b>. Nama Pejabat Pembuat
              Komitmen (PPK) pada SPD tetap diambil dari data kegiatan/ST masing-masing.
            </p>
            <p>
              Perubahan berlaku pada cetak/unduh PDF <b>ST yang dibuat berikutnya</b>. Tidak perlu
              build ulang aplikasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
