// components/notadinas/FormNotaDinas.js — Form buat/edit Nota Dinas
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import {
  FaArrowLeft, FaSave, FaPaperPlane, FaInfoCircle, FaRegStickyNote,
} from 'react-icons/fa';

// Tanggal hari ini dalam format 'YYYY-MM-DD' (waktu lokal, bukan UTC).
function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const kelasInput = 'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400';
const kelasLabel = 'block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function FormNotaDinas() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const editId = router.query.id ? Number(router.query.id) : null;

  const [form, setForm] = useState({
    kepada: '', dari: '', lampiran: '-', hal: '', tanggalNd: hariIni(),
    isi: '', lampiranIsi: '', tempatTerbit: 'Palangka Raya',
    penandatanganNama: '',
  });
  const [katimList, setKatimList] = useState([]);
  const [katimLoading, setKatimLoading] = useState(false);
  const [selectedKatim, setSelectedKatim] = useState('');
  const [origStatus, setOrigStatus] = useState(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ---------- daftar katim (untuk select pengajuan) ----------
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    setKatimLoading(true);
    axiosInstance
      .get('/keycloak/users/by-role/katim')
      .then((r) => setKatimList(r.data?.data || []))
      .catch(() => { /* abaikan — biarkan pilihan kosong */ })
      .finally(() => setKatimLoading(false));
  }, [sessionStatus]);

  // ---------- nama penandatangan (default dari Pengaturan → Pejabat Penandatangan) ----------
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || editId) return;
    axiosInstance
      .get('/pejabat')
      .then((r) => {
        const nama = r.data?.data?.kepala_nama || '';
        setForm((f) => (f.penandatanganNama ? f : { ...f, penandatanganNama: nama }));
      })
      .catch(() => { /* abaikan — biarkan kosong / diisi manual */ });
  }, [sessionStatus, editId]);

  // ---------- mode edit ----------
  useEffect(() => {
    if (!editId || sessionStatus !== 'authenticated') return;
    (async () => {
      try {
        const res = await axiosInstance.get(`/notadinas/${editId}`);
        const d = res.data?.data;
        setOrigStatus(d.status);
        setForm({
          kepada: d.kepada || '', dari: d.dari || '', lampiran: d.lampiran || '-',
          hal: d.hal || '', tanggalNd: d.tanggal_nd || '', isi: d.isi || '',
          lampiranIsi: d.lampiran_isi || '',
          tempatTerbit: d.tempat_terbit || 'Palangka Raya',
          // Snapshot ND ini; bila belum ada (ND lama) pakai nama penandatangan global
          penandatanganNama: d.penandatangan_nama || d.ttd_kepala_nama || '',
        });
      } catch (e) {
        setError(e.response?.data?.message || 'Gagal memuat nota dinas');
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, sessionStatus]);

  const editable = !editId || ['draft', 'dikembalikan'].includes(origStatus);

  const simpan = async () => {
    if (!form.kepada.trim()) { setError('Tujuan (Yth) wajib diisi'); return null; }
    if (!form.dari.trim()) { setError('Pengirim (Dari) wajib diisi'); return null; }
    if (!form.hal.trim()) { setError('Hal/perihal wajib diisi'); return null; }
    if (!form.tanggalNd) { setError('Tanggal nota dinas wajib diisi'); return null; }
    if (!form.isi.trim()) { setError('Isi nota dinas wajib diisi'); return null; }

    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (editId) {
        await axiosInstance.put(`/notadinas/${editId}`, payload);
        return editId;
      }
      const res = await axiosInstance.post('/notadinas', payload);
      return res.data?.data?.id;
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan nota dinas');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSimpanDraft = async () => {
    const id = await simpan();
    if (id) router.push(`/notadinas?id=${id}`);
  };

  const handleSimpanAjukan = async () => {
    const k = katimList.find((x) => String(x.user_id) === String(selectedKatim));
    if (!k) {
      setError('Pilih Katim tujuan terlebih dahulu');
      return;
    }
    const id = await simpan();
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await axiosInstance.post(`/notadinas/${id}/ajukan`, {
        katimKey: k.user_id,
        katimNama: k.nama,
        katimNip: k.nip || null,
      });
      router.push(`/notadinas?id=${id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengirim ke katim');
      setSaving(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex items-center justify-center text-sm animate-pulse text-zinc-400">
        Memuat…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
          <FaArrowLeft className="w-4 h-4" /> Kembali
        </button>
        {!editable && (
          <span className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg">
            Status {origStatus} — tidak dapat diedit
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Info format cetak */}
      <div className="rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 px-4 py-3 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
        <FaInfoCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Format cetak mengikuti template: kertas A4, font Arial 12, spasi 1,15,
          batas tepi kiri 3 cm &amp; kanan 2 cm. Tulis <b>satu paragraf per baris</b>
          {' '}(tekan Enter untuk memulai paragraf baru).
        </span>
      </div>

      <fieldset disabled={!editable || saving} className="space-y-5 disabled:opacity-70">
        {/* Tujuan & pengirim */}
        <Section icon={FaRegStickyNote} title="Tujuan & Pengirim">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className={kelasLabel}>Yth (tujuan) <span className="text-red-500">*</span></label>
              <textarea
                value={form.kepada}
                onChange={(e) => set({ kepada: e.target.value })}
                rows={2}
                placeholder={'Penanggung Jawab Unit Kearsipan II Balai Besar POM\nDi Palangka Raya'}
                className={kelasInput}
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Tekan Enter untuk baris kedua (mis. &quot;Di Palangka Raya&quot;).
              </p>
            </div>
            <div>
              <label className={kelasLabel}>Dari <span className="text-red-500">*</span></label>
              <textarea
                value={form.dari}
                onChange={(e) => set({ dari: e.target.value })}
                rows={2}
                placeholder="Kepala Bagian Tata Usaha"
                className={kelasInput}
              />
            </div>
            <div>
              <label className={kelasLabel}>Hal / Perihal <span className="text-red-500">*</span></label>
              <input
                value={form.hal}
                onChange={(e) => set({ hal: e.target.value })}
                placeholder="Penyampaian Daftar Arsip Aktif Tata Usaha Semester II"
                className={kelasInput}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={kelasLabel}>Lampiran (baris pada surat)</label>
                <input
                  value={form.lampiran}
                  onChange={(e) => set({ lampiran: e.target.value })}
                  placeholder="-"
                  className={kelasInput}
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Teks singkat ini tercetak pada baris &quot;Lampiran : …&quot; di badan surat.
                </p>
              </div>
              <div>
                <label className={kelasLabel}>Tanggal <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.tanggalNd}
                  onChange={(e) => set({ tanggalNd: e.target.value })}
                  className={kelasInput}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Isi */}
        <Section icon={FaRegStickyNote} title="Isi Nota Dinas">
          <textarea
            value={form.isi}
            onChange={(e) => set({ isi: e.target.value })}
            rows={12}
            placeholder="Tulis isi nota dinas di sini. Setiap baris menjadi satu paragraf."
            className={`${kelasInput} leading-relaxed`}
          />
        </Section>

        {/* Isi lampiran (lembar tersendiri di belakang nota dinas) */}
        <Section icon={FaRegStickyNote} title="Lampiran — isi halaman terpisah">
          <textarea
            value={form.lampiranIsi}
            onChange={(e) => set({ lampiranIsi: e.target.value })}
            rows={8}
            placeholder="Kosongkan bila tidak ada lampiran. Setiap baris menjadi satu paragraf."
            className={`${kelasInput} leading-relaxed`}
          />
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Diisi bila ada lembar lampiran. Dicetak sebagai halaman tersendiri dengan kepala
            &quot;Lampiran / Nota Dinas … / Nomor / Tanggal&quot; dan blok tanda tangan.
            Tulis satu paragraf per baris — baris pertama biasanya judul lampiran.
          </p>
        </Section>

        {/* Tanda tangan */}
        <Section icon={FaRegStickyNote} title="Penandatangan">
          <div>
            <label className={kelasLabel}>Nama penandatangan</label>
            <input
              value={form.penandatanganNama}
              onChange={(e) => set({ penandatanganNama: e.target.value })}
              placeholder="Ali Yudhi Hartanto"
              className={kelasInput}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Terisi otomatis dari <b>Pengaturan → Pejabat Penandatangan</b> dan bisa diubah di sini.
            </p>
          </div>
        </Section>
      </fieldset>

      {/* Aksi */}
      {editable && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 border-t border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={selectedKatim}
            onChange={(e) => setSelectedKatim(e.target.value)}
            disabled={katimLoading}
            className="rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:w-72"
          >
            <option value="">{katimLoading ? 'Memuat katim…' : 'Katim tujuan (untuk diajukan)…'}</option>
            {katimList.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.nama}{u.nip ? ` · NIP ${u.nip}` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={handleSimpanDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-4 py-2.5 text-sm font-medium hover:bg-stone-200 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              <FaSave className="w-3.5 h-3.5" /> Simpan Draft
            </button>
            <button
              onClick={handleSimpanAjukan}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 text-zinc-900 px-4 py-2.5 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50"
            >
              <FaPaperPlane className="w-3.5 h-3.5" /> Simpan &amp; Ajukan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
