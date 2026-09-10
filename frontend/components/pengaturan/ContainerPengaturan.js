// components/pengaturan/ContainerPengaturan.js
// Logic modul "Pengaturan — Dasar Aturan" (Menimbang & Dasar)
// - Admin (Arsiparis): kelola paragraf Menimbang (a & b) + Dasar GLOBAL untuk semua user
// - User biasa: Menimbang tampil otomatis (read-only); Dasar = gabungan global (Admin)
//   + tambahan pribadi miliknya. User hanya bisa menambah/mengubah punya sendiri.
// Kalau butuh modal, letakkan file modal di folder: components/pengaturan/modal/
import { useEffect, useState } from 'react';
import { axiosInstance } from '../../utils/axiosInstance';
import {
  FaBookOpen, FaPlus, FaTrash, FaSave, FaEdit, FaSpinner, FaTimes, FaGlobe, FaUser,
} from 'react-icons/fa';

const inputCls =
  'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

const HURUF = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

export default function ContainerPengaturan({ session, status }) {
  const isAdmin = !!session?.user?.isAdminArsiparis;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Menimbang (a & b) — untuk admin: textarea editable; user biasa: read-only
  const [mimb, setMimb] = useState([{ id: null, isi: '' }, { id: null, isi: '' }]);

  // Dasar baru
  const [newIsi, setNewIsi] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit item dasar
  const [editId, setEditId] = useState(null);
  const [editIsi, setEditIsi] = useState('');

  // Pengelompokan
  const menimbang = list
    .filter((d) => d.jenis === 'menimbang')
    .sort((a, b) => a.urutan - b.urutan);
  const globalDasar = list
    .filter((d) => d.jenis === 'dasar' && d.is_global)
    .sort((a, b) => a.urutan - b.urutan);
  const myDasar = list
    .filter((d) => d.jenis === 'dasar' && !d.is_global)
    .sort((a, b) => a.urutan - b.urutan);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/dasaraturan');
      const data = res.data?.data || [];
      setList(data);

      const m = data
        .filter((d) => d.jenis === 'menimbang')
        .sort((a, b) => a.urutan - b.urutan);
      setMimb([
        { id: m[0]?.id ?? null, isi: m[0]?.isi ?? '' },
        { id: m[1]?.id ?? null, isi: m[1]?.isi ?? '' },
      ]);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---------- Menimbang (khusus admin) ----------
  const simpanMimb = async (idx) => {
    const item = mimb[idx];
    const isi = (item.isi || '').trim();
    if (!isi) return;
    setSaving(true);
    setError('');
    try {
      if (item.id) {
        await axiosInstance.put(`/dasaraturan/${item.id}`, { isi });
      } else {
        const res = await axiosInstance.post('/dasaraturan', { isi, jenis: 'menimbang', urutan: idx + 1 });
        const newId = res.data?.data?.id;
        if (newId) setMimb((arr) => arr.map((mm, i) => (i === idx ? { ...mm, id: newId } : mm)));
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan menimbang');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Dasar ----------
  const tambah = async () => {
    if (!newIsi.trim()) return;
    setSaving(true);
    setError('');
    try {
      await axiosInstance.post('/dasaraturan', {
        isi: newIsi.trim(),
        jenis: 'dasar',
        ...(isAdmin ? { is_global: true } : {}), // admin → global; user → pribadi
      });
      setNewIsi('');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const simpanEdit = async () => {
    if (!editIsi.trim()) return;
    setSaving(true);
    setError('');
    try {
      await axiosInstance.put(`/dasaraturan/${editId}`, { isi: editIsi.trim() });
      setEditId(null);
      setEditIsi('');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memperbarui');
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (id) => {
    if (!window.confirm('Hapus dasar aturan ini?')) return;
    setError('');
    try {
      await axiosInstance.delete(`/dasaraturan/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menghapus');
    }
  };

  // ---------- Render baris dasar (global / pribadi) ----------
  const renderRow = (d, isGlobalRow) => {
    const canEdit = isGlobalRow ? isAdmin : true; // global hanya admin, pribadi milik user
    return (
      <div key={d.id} className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-4 flex gap-3">
        <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-bold shrink-0">
          {d.urutan}
        </span>
        {editId === d.id ? (
          <div className="flex-1">
            <textarea
              value={editIsi}
              onChange={(e) => setEditIsi(e.target.value)}
              className={`${inputCls} min-h-[64px]`}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={simpanEdit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white px-3 py-1.5 text-xs font-medium">
                {saving ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaSave className="w-3 h-3" />} Simpan
              </button>
              <button onClick={() => { setEditId(null); setEditIsi(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 dark:bg-zinc-800 text-zinc-600 px-3 py-1.5 text-xs">
                <FaTimes className="w-3 h-3" /> Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isGlobalRow ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <FaGlobe className="w-2.5 h-2.5" /> Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    <FaUser className="w-2.5 h-2.5" /> Saya
                  </span>
                )}
                {!canEdit && (
                  <span className="text-[10px] text-zinc-400">(read-only)</span>
                )}
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">{d.isi}</p>
            </div>
            {canEdit && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { setEditId(d.id); setEditIsi(d.isi); }}
                  className="text-zinc-400 hover:text-amber-500 p-1.5"
                  title="Edit"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
                <button onClick={() => hapus(d.id)} className="text-zinc-400 hover:text-red-500 p-1.5" title="Hapus">
                  <FaTrash className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center">
          <FaBookOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Dasar Aturan</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isAdmin
              ? 'Anda Admin (Arsiparis): kelola Menimbang & Dasar global yang dipakai semua user.'
              : 'Menimbang dikelola Admin. Pilih Dasar saat membuat Surat Tugas, dan tambahkan Dasar pribadi Anda di sini.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-400 animate-pulse">
          Memuat…
        </div>
      ) : (
        <>
          {/* ============ MENIMBANG ============ */}
          <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">Menimbang</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                <FaGlobe className="w-2.5 h-2.5" /> Global — Admin
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Paragraf Menimbang otomatis tampil (read-only) pada Surat Tugas.{' '}
              {isAdmin ? 'Silakan sunting teksnya lalu tekan Simpan.' : 'Hanya Admin (Arsiparis) yang dapat mengubah.'}
            </p>

            {mimb.length === 0 ? (
              <p className="text-sm text-zinc-500">Belum ada paragraf Menimbang.</p>
            ) : (
              <div className="space-y-3">
                {mimb.map((mm, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <span className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {HURUF[idx] || idx + 1}
                    </span>
                    {isAdmin ? (
                      <div className="flex-1">
                        <textarea
                          value={mm.isi}
                          onChange={(e) => setMimb((arr) => arr.map((x, i) => (i === idx ? { ...x, isi: e.target.value } : x)))}
                          className={`${inputCls} min-h-[64px]`}
                          placeholder={`Teks menimbang (${HURUF[idx] || idx + 1})…`}
                        />
                        <div className="flex justify-end mt-1.5">
                          <button
                            onClick={() => simpanMimb(idx)}
                            disabled={saving || !(mm.isi || '').trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 text-zinc-900 px-3 py-1.5 text-xs font-semibold hover:bg-amber-300 disabled:opacity-50"
                          >
                            {saving ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaSave className="w-3 h-3" />}
                            Simpan {HURUF[idx] || idx + 1}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">{mm.isi || '-'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ============ DASAR ============ */}
          <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">Dasar</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Daftar yang dapat dipilih saat membuat Surat Tugas: aturan global (Admin) +{' '}
              {isAdmin ? 'tambahan global yang Anda kelola.' : 'dasar pribadi milik Anda.'}
            </p>

            {/* Form tambah */}
            <label className="block">
              <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {isAdmin ? 'Tambah dasar aturan (global — untuk semua user)' : 'Tambah dasar aturan pribadi'}
              </span>
              <textarea
                value={newIsi}
                onChange={(e) => setNewIsi(e.target.value)}
                placeholder="mis. Peraturan Badan POM Nomor 1 Tahun 2026 tentang …"
                className={`${inputCls} min-h-[72px]`}
              />
            </label>
            <div className="flex justify-end mt-3">
              <button
                onClick={tambah}
                disabled={saving || !newIsi.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 text-zinc-900 px-4 py-2.5 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50"
              >
                {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaPlus className="w-4 h-4" />}
                Tambah
              </button>
            </div>

            {/* Daftar global */}
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-6 mb-2">
              Dari Admin (global) — {globalDasar.length}
            </h4>
            {globalDasar.length === 0 ? (
              <p className="text-sm text-zinc-400">Belum ada aturan global dari Admin.</p>
            ) : (
              <div className="space-y-2.5">{globalDasar.map((d) => renderRow(d, true))}</div>
            )}

            {/* Daftar pribadi */}
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-6 mb-2">
              Milik Saya — {myDasar.length}
            </h4>
            {myDasar.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Belum ada dasar pribadi. Tambahkan di atas bila ada aturan tambahan di luar aturan Admin.
              </p>
            ) : (
              <div className="space-y-2.5">{myDasar.map((d) => renderRow(d, false))}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
