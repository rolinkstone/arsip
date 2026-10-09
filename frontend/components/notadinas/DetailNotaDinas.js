// components/notadinas/DetailNotaDinas.js — Detail Nota Dinas + aksi sesuai role
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import { tglIndo, statusMeta } from '../../utils/suratFormat';
import {
  FaArrowLeft, FaEdit, FaPaperPlane, FaTrash, FaStamp, FaPrint,
  FaUserShield, FaSpinner, FaRegStickyNote,
} from 'react-icons/fa';

const btnBase = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50';
const kelasInput = 'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400';

/** Teks → daftar paragraf (satu baris = satu paragraf, baris kosong diabaikan). */
function keParagraf(teks) {
  return String(teks || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function DetailNotaDinas() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const id = router.query.id;

  const user = session?.user || {};
  const isKatim = !!user.isKatim;
  const isAdminArsiparis = !!user.isAdminArsiparis;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // 'verifikasi' | 'penomoran' | 'hapus'
  const [katimList, setKatimList] = useState([]);
  const [katimLoading, setKatimLoading] = useState(false);
  const [selectedKatim, setSelectedKatim] = useState('');
  const [keputusan, setKeputusan] = useState('setujui');
  const [catatan, setCatatan] = useState('');
  const [nomorNd, setNomorNd] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get(`/notadinas/${id}`);
      setData(res.data?.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === 'authenticated' && id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessionStatus]);

  // muat daftar katim (untuk select pengajuan)
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    setKatimLoading(true);
    axiosInstance
      .get('/keycloak/users/by-role/katim')
      .then((r) => setKatimList(r.data?.data || []))
      .catch(() => { /* abaikan */ })
      .finally(() => setKatimLoading(false));
  }, [sessionStatus]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-zinc-400 animate-pulse">
        Memuat…
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-red-500">{error || 'Nota dinas tidak ditemukan'}</p>;
  }

  const meta = statusMeta(data.status);
  const isOwner = session?.user?.id && data.user_key === session.user.id;
  const showAjukan = isOwner && ['draft', 'dikembalikan'].includes(data.status);
  const showVerifikasi = isKatim && data.status === 'diajukan';
  const showPenomoran = isAdminArsiparis && data.status === 'disetujui';
  const showCetak = data.status === 'terbit';

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setModal(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  };

  const ajukanKeKatim = async () => {
    const k = katimList.find((x) => String(x.user_id) === String(selectedKatim));
    if (!k) {
      setError('Pilih Katim tujuan terlebih dahulu');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await axiosInstance.post(`/notadinas/${id}/ajukan`, {
        katimKey: k.user_id,
        katimNama: k.nama,
        katimNip: k.nip || null,
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengirim ke katim');
    } finally {
      setBusy(false);
    }
  };

  const aksi = {
    hapus: () => run(() => axiosInstance.delete(`/notadinas/${id}`)).then(() => router.push('/notadinas')),
    verifikasi: () => run(() => axiosInstance.post(`/notadinas/${id}/verifikasi`, { keputusan, catatan })),
    penomoran: () => run(() => axiosInstance.post(`/notadinas/${id}/penomoran`, { nomorNd })),
  };

  const paragraf = keParagraf(data.isi);
  const paragrafLampiran = keParagraf(data.lampiran_isi);

  return (
    <>
      <div className="space-y-5">
        {/* Toolbar aksi */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <FaArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div className="flex flex-wrap gap-2">
            {showAjukan && (
              <>
                <Link href={`/notadinas?mode=tambah&id=${data.id}`} className={`${btnBase} bg-stone-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-stone-200`}>
                  <FaEdit className="w-3.5 h-3.5" /> Edit
                </Link>
                <select
                  value={selectedKatim}
                  onChange={(e) => setSelectedKatim(e.target.value)}
                  className="rounded-lg border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 w-64"
                >
                  <option value="">{katimLoading ? 'Memuat katim…' : 'Katim tujuan…'}</option>
                  {katimList.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.nama}{u.nip ? ` · NIP ${u.nip}` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={ajukanKeKatim} disabled={busy || katimLoading} className={`${btnBase} bg-amber-400 text-zinc-900 hover:bg-amber-300`}>
                  <FaPaperPlane className="w-3.5 h-3.5" /> Ajukan ke Katim
                </button>
                <button onClick={() => setModal('hapus')} className={`${btnBase} bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100`}>
                  <FaTrash className="w-3.5 h-3.5" /> Hapus
                </button>
              </>
            )}
            {showVerifikasi && (
              <button onClick={() => { setKeputusan('setujui'); setCatatan(''); setModal('verifikasi'); }} className={`${btnBase} bg-amber-400 text-zinc-900 hover:bg-amber-300`}>
                <FaUserShield className="w-3.5 h-3.5" /> Verifikasi
              </button>
            )}
            {showPenomoran && (
              <button onClick={() => { setNomorNd(data.nomor_nd || ''); setModal('penomoran'); }} className={`${btnBase} bg-blue-500 text-white hover:bg-blue-400`}>
                <FaStamp className="w-3.5 h-3.5" /> Penomoran
              </button>
            )}
            {showCetak && (
              <a
                href={`/notadinas?id=${data.id}&cetak=1`}
                target="_blank"
                rel="noreferrer"
                className={`${btnBase} bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700`}
              >
                <FaPrint className="w-3.5 h-3.5" /> Cetak Nota Dinas
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Info utama */}
        <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center">
                <FaRegStickyNote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{data.hal || '(tanpa hal)'}</h3>
                <p className="text-sm text-zinc-500">Oleh: {data.username || '-'}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Nomor Nota Dinas</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.nomor_nd || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Tanggal</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{tglIndo(data.tanggal_nd)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Lampiran</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.lampiran || '-'}</p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Yth</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100 whitespace-pre-line">{data.kepada || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Dari</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100 whitespace-pre-line">{data.dari || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Penandatangan</p>
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.penandatangan_nama || '-'}</p>
              {data.penandatangan_nip && <p className="text-xs text-zinc-400">NIP {data.penandatangan_nip}</p>}
            </div>
          </div>

          {data.katim_nama && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium px-3 py-1.5">
              <FaUserShield className="w-3.5 h-3.5" />
              Diajukan ke katim: {data.katim_nama}
              {data.katim_nip ? ` · NIP ${data.katim_nip}` : ''}
            </div>
          )}

          {data.catatan && (
            <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <b>Catatan pengembalian: </b>{data.catatan}
            </div>
          )}
          {data.catatan_verifikasi && data.status !== 'dikembalikan' && (
            <div className="mt-4 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
              <b>Catatan verifikasi: </b>{data.catatan_verifikasi}
            </div>
          )}
        </section>

        {/* Isi */}
        <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-3">Isi Nota Dinas</h3>
          {paragraf.length === 0 ? (
            <p className="text-sm text-zinc-400">(isi kosong)</p>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              {paragraf.map((p, i) => (
                <p key={i} className="text-justify">{p}</p>
              ))}
            </div>
          )}
        </section>

        {/* Lampiran (lembar tersendiri) */}
        {paragrafLampiran.length > 0 && (
          <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-3">
              Lampiran <span className="font-normal text-zinc-400">(halaman terpisah)</span>
            </h3>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              {paragrafLampiran.map((p, i) => (
                <p key={i} className="text-justify">{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Jejak langkah */}
        {(data.log || []).length > 0 && (
          <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-3">Riwayat</h3>
            <ul className="space-y-2">
              {data.log.map((l) => (
                <li key={l.id} className="flex items-start gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>
                    <b className="text-zinc-700 dark:text-zinc-200 capitalize">{l.aksi}</b>
                    {' · '}{l.username || '-'}
                    {l.catatan ? ` · ${l.catatan}` : ''}
                    <span className="block text-[11px] text-zinc-400">
                      {l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* ==================== MODAL ==================== */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xl">
            {modal === 'hapus' && (
              <>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Hapus nota dinas?</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Nota dinas #{data.id} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800">Batal</button>
                  <button onClick={aksi.hapus} disabled={busy} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50">
                    {busy && <FaSpinner className="w-3.5 h-3.5 animate-spin" />} Hapus
                  </button>
                </div>
              </>
            )}

            {modal === 'verifikasi' && (
              <>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Verifikasi nota dinas</h3>
                <p className="mt-1 text-xs text-zinc-500">{data.hal}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setKeputusan('setujui')}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium ${keputusan === 'setujui' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-stone-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => setKeputusan('kembalikan')}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium ${keputusan === 'kembalikan' ? 'border-red-400 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300' : 'border-stone-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    Kembalikan
                  </button>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                    Catatan {keputusan === 'kembalikan' ? '(wajib diisi)' : '(opsional)'}
                  </label>
                  <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} className={kelasInput} />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800">Batal</button>
                  <button
                    onClick={aksi.verifikasi}
                    disabled={busy || (keputusan === 'kembalikan' && !catatan.trim())}
                    className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy && <FaSpinner className="w-3.5 h-3.5 animate-spin" />} Simpan
                  </button>
                </div>
              </>
            )}

            {modal === 'penomoran' && (
              <>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Penomoran nota dinas</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Masukkan nomor resmi nota dinas. Setelah disimpan, status berubah menjadi <b>terbit</b> dan dokumen dapat dicetak.
                </p>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">Nomor Nota Dinas</label>
                  <input
                    value={nomorNd}
                    onChange={(e) => setNomorNd(e.target.value)}
                    placeholder="KA.04.01.16A.04.24.20"
                    className={kelasInput}
                  />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100 dark:hover:bg-zinc-800">Batal</button>
                  <button onClick={aksi.penomoran} disabled={busy || !nomorNd.trim()} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50">
                    {busy && <FaSpinner className="w-3.5 h-3.5 animate-spin" />} Terbitkan
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
