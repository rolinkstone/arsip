// components/pengaturan/ContainerPenomoran.js
// Logic modul "Pengaturan — Penomoran Manual" (nomor SPPD otomatis).
//
// Halaman ini KHUSUS admin arsiparis. Penjagaan sebenarnya ada di backend
// (routes/penomoran.js → hanyaAdmin); di sini hanya menampilkan penolakan.
//
// Cara kerja penomoran SPPD (lihat backend/utils/penomoran.js):
//  - Nomor SPPD = angka urut murni (1, 2, 3, …) dan diberikan OTOMATIS oleh
//    server saat admin menekan "Terbitkan Nomor" pada halaman detail ST.
//  - Urutan dihitung PER TAHUN (tahun diambil dari tanggal Surat Tugas) dan
//    otomatis mulai dari 1 lagi saat tahun berganti.
//  - Yang diatur di halaman ini hanya TITIK LANJUTNYA, yaitu "nomor terakhir
//    yang sudah dipakai" pada tahun tsb.
//      contoh: diisi 335 → SPPD berikutnya otomatis 336, 337, 338, …
//    Isi 0 bila tahun itu belum pernah dipakai (mulai dari 1).
import { useCallback, useEffect, useState } from 'react';
import { axiosInstance } from '../../utils/axiosInstance';
import {
  FaInfoCircle, FaLock, FaSave, FaSpinner, FaStamp, FaSyncAlt,
} from 'react-icons/fa';

const inputCls =
  'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

const TAHUN_INI = new Date().getFullYear();

export default function ContainerPenomoran({ session, status }) {
  const isAdmin = !!session?.user?.isAdminArsiparis;

  const [tahun, setTahun] = useState(TAHUN_INI);
  const [terakhir, setTerakhir] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');

  const load = useCallback(async (th) => {
    setLoading(true);
    setError('');
    setPesan('');
    try {
      const res = await axiosInstance.get('/penomoran', { params: { tahun: th } });
      const d = res.data?.data || {};
      setTahun(d.tahun ?? th);
      setTerakhir(String(d.terakhir ?? 0));
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat pengaturan penomoran');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return;
    load(TAHUN_INI);
  }, [status, isAdmin, load]);

  const simpan = async () => {
    setSaving(true);
    setError('');
    setPesan('');
    try {
      const res = await axiosInstance.put('/penomoran', {
        tahun: Number(tahun),
        terakhir: Number(terakhir),
      });
      const d = res.data?.data;
      if (d) {
        setTahun(d.tahun);
        setTerakhir(String(d.terakhir));
      }
      setPesan(res.data?.message || 'Pengaturan penomoran disimpan.');
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan pengaturan penomoran');
    } finally {
      setSaving(false);
    }
  };

  // ---------- tampilan: belum login ----------
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
              Halaman Penomoran Manual hanya dapat dibuka oleh <b>Admin Arsiparis</b>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const nomorBerikutnya = Math.max(0, Number(terakhir) || 0) + 1;
  const tahunBerubah = Number(tahun) !== TAHUN_INI;

  return (
    <div className="max-w-3xl space-y-5">
      {/* ===== Keterangan cara kerja ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <FaStamp className="w-4 h-4" />
          </span>
          <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Nomor SPPD otomatis</h3>
            <p>
              Nomor SPPD diberikan <b>otomatis oleh sistem</b> saat admin menekan
              <b> Terbitkan Nomor</b> pada detail Surat Tugas — berupa angka urut
              (1, 2, 3, …), satu nomor untuk tiap pegawai.
            </p>
            <p>
              Urutan dihitung <b>per tahun</b> (mengikuti tanggal Surat Tugas) dan
              otomatis <b>mulai dari 1 lagi</b> saat tahun berganti.
            </p>
          </div>
        </div>
      </div>

      {/* ===== Form pengaturan ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Nomor SPPD terakhir</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Isi sesuai buku agenda: nomor terakhir yang <b>sudah dipakai</b> pada tahun tersebut.
          SPPD berikutnya melanjut dari angka itu.
        </p>

        {loading ? (
          <div className="py-6 flex items-center gap-2 text-sm text-zinc-400">
            <FaSpinner className="w-4 h-4 animate-spin" /> Memuat…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">Tahun</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  className={inputCls}
                />
                {tahunBerubah && (
                  <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">
                    Bukan tahun berjalan ({TAHUN_INI}).
                  </span>
                )}
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">Nomor terakhir</span>
                <input
                  type="number"
                  min={0}
                  value={terakhir}
                  onChange={(e) => setTerakhir(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>

            {/* Pratinjau nomor berikutnya */}
            <div className="mt-4 rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                SPPD berikutnya pada tahun <b>{tahun}</b>:
              </p>
              <p className="mt-1 font-mono text-sm text-zinc-800 dark:text-zinc-100">
                {nomorBerikutnya}, {nomorBerikutnya + 1}, {nomorBerikutnya + 2}, …
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
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
                Simpan
              </button>
              <button
                onClick={() => load(tahun)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                <FaSyncAlt className="w-3.5 h-3.5" /> Muat tahun ini
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Catatan tambahan ===== */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <FaInfoCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              Nomor yang sudah terbit <b>tidak berubah</b> walau pengaturan ini diubah —
              pengaturan hanya memengaruhi penomoran <b>berikutnya</b>.
            </p>
            <p>
              Bila satu ST berisi beberapa pegawai, sistem memakai sekaligus sejumlah itu
              (mis. 3 pegawai = 3 nomor berikutnya).
            </p>
            <p>
              Urutan tiap tahun terpisah, jadi mengubah angka tahun ini tidak memengaruhi tahun lain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
