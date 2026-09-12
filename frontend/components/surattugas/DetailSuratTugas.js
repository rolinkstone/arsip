// components/surattugas/DetailSuratTugas.js — Detail Surat Tugas + aksi sesuai role
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import { tglIndo, statusMeta } from '../../utils/suratFormat';
import {
  FaArrowLeft, FaEdit, FaPaperPlane, FaTrash, FaCheck, FaUndo, FaStamp,
  FaPrint, FaUserShield, FaSpinner, FaFileSignature, FaClock,
} from 'react-icons/fa';

export default function DetailSuratTugas() {
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
  const [nomorSt, setNomorSt] = useState('');
  const [nomorSppdOtomatis, setNomorSppdOtomatis] = useState([]); // pratinjau: { id, urutan, nama, nomor }
  const [tahunNomor, setTahunNomor] = useState(null);
  const [memuatNomor, setMemuatNomor] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get(`/surattugas/${id}`);
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
      .catch(() => {})
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
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-500">{error || 'Surat tugas tidak ditemukan'}</p>
      </div>
    );
  }

  const meta = statusMeta(data.status);
  const isOwner = session?.user?.id && data.user_key === session.user.id;
  const canEdit = isOwner && ['draft', 'dikembalikan'].includes(data.status);
  const showAjukan = isOwner && ['draft', 'dikembalikan'].includes(data.status);
  const showVerifikasi = isKatim && data.status === 'diajukan';
  const showPenomoran = isAdminArsiparis && data.status === 'disetujui';
  const showCetak = data.status === 'terbit';

  // Buka modal penomoran + ambil pratinjau nomor SPPD yang AKAN diberikan server.
  // Nomor SPPD tidak lagi diketik manual — diatur di Pengaturan → Penomoran Manual.
  const openPenomoran = () => {
    setModal('penomoran');
    setNomorSppdOtomatis([]);
    setTahunNomor(null);
    setMemuatNomor(true);
    axiosInstance
      .get(`/surattugas/${id}/pratinjau-nomor`)
      .then((r) => {
        setNomorSppdOtomatis(r.data?.data?.sppd || []);
        setTahunNomor(r.data?.data?.tahun ?? null);
      })
      .catch((e) => setError(e.response?.data?.message || 'Gagal memuat pratinjau nomor SPPD'))
      .finally(() => setMemuatNomor(false));
  };

  const run = async (fn, closeModal = true) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (closeModal) setModal(null);
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
      await axiosInstance.post(`/surattugas/${id}/ajukan`, {
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
    hapus: () => run(() => axiosInstance.delete(`/surattugas/${id}`), true).then(() => router.push('/surattugas')),
    verifikasi: () =>
      run(() =>
        axiosInstance.post(`/surattugas/${id}/verifikasi`, { keputusan, catatan })
      ),
    // Nomor SPPD diberikan OTOMATIS oleh server (angka urut per tahun) — lihat
    // Pengaturan → Penomoran Manual. Jadi klien hanya mengirim Nomor ST.
    penomoran: () => run(() => axiosInstance.post(`/surattugas/${id}/penomoran`, { nomorSt })),
  };

  const btnBase = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50';

  return (
    <>
      <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              <FaArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <div className="flex flex-wrap gap-2">
              {showAjukan && (
                <>
                  <Link href={`/surattugas?mode=tambah&id=${data.id}`} className={`${btnBase} bg-stone-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-stone-200`}>
                    <FaEdit className="w-3.5 h-3.5" /> Edit
                  </Link>
                  <select
                    value={selectedKatim}
                    onChange={(e) => setSelectedKatim(e.target.value)}
                    className="rounded-lg border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 w-64"
                  >
                    <option value="">Katim tujuan…</option>
                    {katimList.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.nama}{u.nip ? ` · NIP ${u.nip}` : ''}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => ajukanKeKatim()} disabled={busy || katimLoading} className={`${btnBase} bg-amber-400 text-zinc-900 hover:bg-amber-300`}>
                    <FaPaperPlane className="w-3.5 h-3.5" /> Ajukan ke Katim
                  </button>
                  <button onClick={() => setModal('hapus')} className={`${btnBase} bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100`}>
                    <FaTrash className="w-3.5 h-3.5" /> Hapus
                  </button>
                </>
              )}
              {showVerifikasi && (
                <button onClick={() => setModal('verifikasi')} className={`${btnBase} bg-amber-400 text-zinc-900 hover:bg-amber-300`}>
                  <FaUserShield className="w-3.5 h-3.5" /> Verifikasi
                </button>
              )}
              {showPenomoran && (
                <button onClick={openPenomoran} className={`${btnBase} bg-blue-500 text-white hover:bg-blue-400`}>
                  <FaStamp className="w-3.5 h-3.5" /> Penomoran
                </button>
              )}
              {showCetak && (
                /* Cetak SPPD TIDAK lagi digabung di sini — masing-masing SPPD
                   punya tombol cetak sendiri di tabel SPPD (per pegawai). */
                <>
                  <a href={`/surattugas?id=${data.id}&cetak=1&jenis=st`} target="_blank" rel="noreferrer" className={`${btnBase} bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700`}>
                    <FaPrint className="w-3.5 h-3.5" /> Cetak ST
                  </a>
                  {/* SATU berkas PDF: ST + lampiran + semua SPD (halaman belakang sekali saja) */}
                  <a href={`/surattugas?id=${data.id}&cetak=1&jenis=semua`} target="_blank" rel="noreferrer" className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-500`}>
                    <FaPrint className="w-3.5 h-3.5" /> Unduh Semua
                  </a>
                </>
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
                  <FaFileSignature className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{data.kegiatan || '(tanpa kegiatan)'}</h3>
                  <p className="text-sm text-zinc-500">
                    Oleh: {data.username || '-'}
                    {!isOwner && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-500/10 text-[9px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-300 px-2 py-0.5 align-middle">
                        Anda peserta
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {data.tanpa_sppd && (
                  <span className="inline-flex items-center rounded-full bg-stone-100 dark:bg-zinc-800 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 px-2.5 py-1">
                    Tanpa SPPD
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Nomor Surat Tugas</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.nomor_st || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Tanggal ST</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{tglIndo(data.tanggal_st)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Tempat Terbit</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.tempat_terbit || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Kepala Balai (Penandatangan)</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {data.nama_kabalai || data.ttd_kepala_nama || '-'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Mata Anggaran</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.mak || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Kota / Tujuan</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.kota_kab_kecamatan || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">PPK</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{data.ppk_nama || '-'}</p>
                {data.ppk_nip && <p className="text-xs text-zinc-400">NIP {data.ppk_nip}</p>}
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

          {/* Menimbang & Dasar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-3">Menimbang</h4>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                <p><span className="font-semibold">a.</span> {data.menimbang_a || '-'}</p>
                <p><span className="font-semibold">b.</span> {data.menimbang_b || '-'}</p>
              </div>
              {data.untuk && (
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-zinc-800">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Untuk</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">{data.untuk}</p>
                </div>
              )}
            </section>
            <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-3">Dasar</h4>
              {data.dasar?.length ? (
                <ol className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300 list-decimal list-inside">
                  {data.dasar.map((d) => <li key={d.id}>{d.isi}</li>)}
                </ol>
              ) : <p className="text-sm text-zinc-400">Tidak ada dasar dipilih</p>}
            </section>
          </div>

          {/* SPPD list (hanya bila ST dengan SPPD) */}
          {!data.tanpa_sppd && (
          <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                SPPD ({data.sppd?.length || 0})
              </h4>
            </div>
            {data.sppd?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-400 border-b border-stone-100 dark:border-zinc-800">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">No SPPD</th>
                      <th className="py-2 pr-3">Nama / NIP</th>
                      <th className="py-2 pr-3">Biaya</th>
                      <th className="py-2 pr-3">Angkut</th>
                      <th className="py-2 pr-3">Berangkat</th>
                      <th className="py-2 pr-3">Kembali</th>
                      <th className="py-2">Cetak SPPD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                    {data.sppd.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-3 text-zinc-400">{s.urutan}</td>
                        <td className="py-2.5 pr-3 font-semibold text-zinc-800 dark:text-zinc-100">{s.nomor_sppd || '—'}</td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-zinc-800 dark:text-zinc-100">{s.nama || '-'}</p>
                          {s.nip && <p className="text-xs text-zinc-400">{s.nip}</p>}
                        </td>
                        <td className="py-2.5 pr-3">{s.tingkat_biaya || '—'}</td>
                        <td className="py-2.5 pr-3">{s.alat_angkut || '—'}</td>
                        <td className="py-2.5 pr-3">{s.tanggal_berangkat ? tglIndo(s.tanggal_berangkat) : '—'}</td>
                        <td className="py-2.5 pr-3">{s.tanggal_kembali ? tglIndo(s.tanggal_kembali) : '—'}</td>
                        <td className="py-2.5">
                          {showCetak ? (
                            <a
                              href={`/surattugas?id=${data.id}&cetak=1&jenis=sppd&sppd=${s.id}`}
                              target="_blank"
                              rel="noreferrer"
                              title={`Cetak SPPD ${s.nama || ''}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
                            >
                              <FaPrint className="w-3 h-3" /> Cetak
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-zinc-400">Belum ada SPPD</p>}
          </section>
          )}

          {/* Log workflow */}
          {data.log?.length > 0 && (
            <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <FaClock className="w-4 h-4 text-zinc-400" /> Riwayat
              </h4>
              <ol className="space-y-3">
                {data.log.map((l) => (
                  <li key={l.id} className="flex gap-3 text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-zinc-700 dark:text-zinc-200">{l.catatan || l.aksi}</p>
                      <p className="text-xs text-zinc-400">
                        {l.username || l.user_key || '-'} · {l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* ============ MODALS ============ */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-700 p-5">
              {modal === 'hapus' && (
                <>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Hapus Surat Tugas?</h4>
                  <p className="text-sm text-zinc-500 mb-4">Seluruh SPPD terkait ikut terhapus. Tindakan tidak bisa dibatalkan.</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100">Batal</button>
                    <button onClick={aksi.hapus} disabled={busy} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white inline-flex items-center gap-2">
                      {busy && <FaSpinner className="w-4 h-4 animate-spin" />} Hapus
                    </button>
                  </div>
                </>
              )}
              {modal === 'verifikasi' && (
                <>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Verifikasi Surat Tugas</h4>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setKeputusan('setujui')}
                        className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${keputusan === 'setujui' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-stone-200 dark:border-zinc-700 text-zinc-500'}`}
                      >
                        <FaCheck className="inline w-3.5 h-3.5 mr-1" /> Setujui
                      </button>
                      <button
                        onClick={() => setKeputusan('kembalikan')}
                        className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${keputusan === 'kembalikan' ? 'border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300' : 'border-stone-200 dark:border-zinc-700 text-zinc-500'}`}
                      >
                        <FaUndo className="inline w-3.5 h-3.5 mr-1" /> Kembalikan
                      </button>
                    </div>
                    {keputusan === 'kembalikan' && (
                      <textarea
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        placeholder="Alasan pengembalian…"
                        className="w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                        rows={3}
                      />
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100">Batal</button>
                    <button
                      onClick={aksi.verifikasi}
                      disabled={busy}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white inline-flex items-center gap-2 ${keputusan === 'setujui' ? 'bg-emerald-500' : 'bg-red-500'}`}
                    >
                      {busy && <FaSpinner className="w-4 h-4 animate-spin" />}
                      {keputusan === 'setujui' ? 'Setujui' : 'Kembalikan'}
                    </button>
                  </div>
                </>
              )}
              {modal === 'penomoran' && (
                <>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Penomoran Surat Tugas</h4>
                  <p className="text-xs text-zinc-500 mb-3">
                    Nomor ST diketik sesuai format. Nomor SPPD diberikan <b>otomatis</b> oleh sistem
                    (angka urut tahun {tahunNomor ?? '—'}), satu nomor per pegawai. Titik awalnya diatur di
                    <b> Pengaturan → Penomoran Manual</b>.
                  </p>
                  <label className="block mb-4">
                    <span className="block text-xs font-medium text-zinc-500 mb-1">Nomor Surat Tugas *</span>
                    <input
                      value={nomorSt}
                      onChange={(e) => setNomorSt(e.target.value)}
                      placeholder="mis. KP.06.01.16A.09.26.001"
                      className="w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {memuatNomor ? (
                      <div className="flex items-center gap-2 text-sm text-zinc-400 px-1 py-2">
                        <FaSpinner className="w-4 h-4 animate-spin" /> Memuat nomor otomatis…
                      </div>
                    ) : (data.sppd || []).length === 0 ? (
                      <p className="text-sm text-zinc-400 px-1 py-2">ST ini tanpa SPPD.</p>
                    ) : (
                      <div className="rounded-xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                        <div className="px-3 py-2 bg-stone-50 dark:bg-zinc-800/60 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Nomor SPPD otomatis
                        </div>
                        {(data.sppd || []).map((s) => {
                          const auto = nomorSppdOtomatis.find((x) => String(x.id) === String(s.id));
                          return (
                            <div key={s.id} className="flex items-center gap-3 px-3 py-2 border-t border-stone-200 dark:border-zinc-700">
                              <span className="text-xs text-zinc-400 w-5 shrink-0">#{s.urutan}</span>
                              <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-200 truncate">{s.nama || '-'}</span>
                              <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100 shrink-0">
                                {auto?.nomor ?? '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!memuatNomor && (data.sppd || []).length > 0 && (
                      <p className="text-[11px] text-zinc-400 px-1">
                        Perkiraan — nomor final diberikan saat tombol Terbitkan Nomor ditekan.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:bg-stone-100">Batal</button>
                    <button onClick={aksi.penomoran} disabled={busy || !nomorSt.trim()} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50">
                      {busy && <FaSpinner className="w-4 h-4 animate-spin" />} Terbitkan Nomor
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
