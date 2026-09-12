// components/surattugas/FormSuratTugas.js — Form buat / edit Surat Tugas + SPPD
// Mendukung mode edit lewat query ?id=<surat_tugas_id> (status draft/dikembalikan)
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { axiosInstance } from '../../utils/axiosInstance';
import { TINGKAT_BIAYA, ALAT_ANGKUT } from '../../utils/suratFormat';
import {
  FaSearch, FaPlus, FaTrash, FaSave, FaPaperPlane, FaArrowLeft, FaSpinner, FaBookOpen, FaUsers, FaUserShield, FaFileSignature,
} from 'react-icons/fa';

const INSTANSI = 'Balai Besar POM di Palangka Raya';

const MENIMBANG_A_DEFAULT =
  'Bahwa dalam rangka untuk menunjang pelaksanaan tugas dan fungsi Balai Besar POM di Palangka Raya sebagai Unit Pelaksana Teknis di Lingkungan Badan POM;';
const MENIMBANG_B_DEFAULT =
  'Bahwa untuk memenuhi maksud pada butir a di atas, ditunjuk pegawai Balai Besar POM di Palangka Raya untuk mengikuti kegiatan tersebut.';

// Dasar yang OTOMATIS tercentang saat MEMBUAT ST baru (mode tambah).
// Dicocokkan lewat kata kunci (huruf kecil, spasi dirapikan) supaya tidak bergantung
// pada spasi / baris baru di database. Perbarui daftar ini bila aturannya berganti.
const DASAR_DEFAULT_KATA_KUNCI = [
  'nomor 1 tahun 2026',
  'organisasi dan tata kerja unit pelaksana teknis',
];

function isDasarDefault(isi) {
  const teks = String(isi || '').toLowerCase().replace(/\s+/g, ' ');
  return DASAR_DEFAULT_KATA_KUNCI.every((k) => teks.includes(k));
}

const emptyPeserta = () => ({
  nama: '', nip: '', pangkat: '', jabatan: '', instansi: INSTANSI, sumber: 'manual',
  sppd: { tingkatBiaya: '', alatAngkut: '', tempatBerangkat: 'Palangka Raya', tanggalBerangkat: '', tanggalKembali: '' },
});

function hitungLama(from, to) {
  if (!from || !to) return '';
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const hari = Math.round(Math.abs(b - a) / 86400000) + 1;
  return `${hari} Hari`;
}

const inputCls =
  'w-full rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-stone-50 dark:disabled:bg-zinc-800 disabled:text-zinc-400';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
        <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function field(label, value, onChange, opts = {}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{label}</span>
      <input
        className={inputCls}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={opts.disabled}
        type={opts.type || 'text'}
        placeholder={opts.placeholder || ''}
      />
    </label>
  );
}

/* Pencarian nama peserta yang terhubung ke user Keycloak.
   Ketik nama atau NIP → daftar user cocok muncul; klik salah satu untuk mengisi
   Nama + NIP + Jabatan otomatis. Tetap bisa diisi manual bila user tidak ada. */
function NamaPesertaPicker({ value, users, loading, onRequestLoad, onChange, onPick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // tutup dropdown saat klik di luar
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const term = String(value || '').trim().toLowerCase();
  const termNip = term.replace(/\s/g, '');
  const hasil = (term
    ? users.filter((u) =>
        String(u.nama || '').toLowerCase().includes(term) ||
        (termNip && String(u.nip || '').replace(/\s/g, '').includes(termNip)))
    : users
  ).slice(0, 8);

  return (
    <div className="relative" ref={wrapRef}>
      <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
        Nama Lengkap &amp; Gelar *
        <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">· cari di Keycloak</span>
      </span>
      <input
        className={inputCls}
        value={value || ''}
        autoComplete="off"
        placeholder="ketik nama/NIP untuk mencari, atau isi manual"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { onRequestLoad(); setOpen(true); }}
      />

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-500 inline-flex items-center gap-2">
              <FaSpinner className="w-3 h-3 animate-spin" /> Memuat user Keycloak…
            </div>
          )}
          {!loading && hasil.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">
              {users.length === 0
                ? 'Data user Keycloak tidak tersedia — silakan isi manual.'
                : 'Tidak ada user yang cocok.'}
            </div>
          )}
          {!loading && hasil.map((u) => (
            <button
              type="button"
              key={u.id || u.username}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(u); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            >
              <span className="block text-sm text-zinc-800 dark:text-zinc-100">{u.nama}</span>
              <span className="block text-[11px] text-zinc-500">
                {u.nip ? `NIP ${u.nip}` : 'NIP —'}{u.pangkat ? ` · ${u.pangkat}` : ''}
              </span>
              {u.jabatan && (
                <span className="block text-[11px] text-zinc-400">{u.jabatan}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FormSuratTugas() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const editId = router.query.id ? Number(router.query.id) : null;

  // ---------- Data ST ----------
  const [form, setForm] = useState({
    kegiatanId: null, kegiatanSumber: 'talawang', kegiatan: '', mak: '', kota: '',
    tglMulai: '', tglSelesai: '',
    tanggalSt: '', tempatTerbit: 'Palangka Raya',
    // Snapshot nama Kepala Balai untuk ST ini (terisi otomatis dari
    // Pengaturan → Pejabat Penandatangan saat membuat ST baru).
    // Disimpan di DB, jadi ST yang sudah dibuat TIDAK berubah walau
    // pejabat berganti (lihat migrasi 009).
    namaKabalai: '',
    untuk: '',
    menimbangA: MENIMBANG_A_DEFAULT, menimbangB: MENIMBANG_B_DEFAULT,
    tanpaSppd: false, // default ST dengan SPPD; true = tanpa SPPD
    ppkId: '', ppkNama: '', ppkNip: '', ppkManual: false,
  });
  const [dasarOptions, setDasarOptions] = useState([]);
  const [dasarSelected, setDasarSelected] = useState([]); // [{id, isi}]
  const [menimbangList, setMenimbangList] = useState([]); // global menimbang (admin)
  const [peserta, setPeserta] = useState([]);

  // ---------- UI kegiatan talawang ----------
  const [kegiatanQuery, setKegiatanQuery] = useState('');
  const [kegiatanResults, setKegiatanResults] = useState([]);
  const [searchingKegiatan, setSearchingKegiatan] = useState(false);
  const [kegiatanSearched, setKegiatanSearched] = useState(false); // sudah pernah cari (utk pesan hasil kosong)
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [origStatus, setOrigStatus] = useState(null);
  const [editLoaded, setEditLoaded] = useState(false);
  // Katim tujuan (select) untuk pengajuan
  const [katimList, setKatimList] = useState([]);
  const [katimLoading, setKatimLoading] = useState(false);
  const [selectedKatim, setSelectedKatim] = useState('');

  // ---------- Daftar user Keycloak (pencarian "Nama Lengkap & Gelar" peserta) ----------
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const usersFetchedRef = useRef(false);

  // dimuat saat kolom nama pertama kali difokuskan (dipakai bersama semua baris peserta)
  const loadUsers = useCallback(async () => {
    if (usersFetchedRef.current) return;
    usersFetchedRef.current = true;
    setUsersLoading(true);
    try {
      const res = await axiosInstance.get('/keycloak/users/all-simple');
      setUsers(res.data?.data || []);
    } catch (e) {
      usersFetchedRef.current = false; // gagal → biarkan dicoba lagi saat fokus berikutnya
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // ---------- muat dasar aturan (global admin + milik user) ----------
  const loadDasar = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/dasaraturan', { params: { jenis: 'dasar' } });
      const items = (res.data?.data || []).filter((d) => d.is_active);
      setDasarOptions(items);
      // Mode TAMBAH: centang otomatis dasar default.
      // Mode EDIT: dasar mengikuti data yang tersimpan (lihat effect pemuatan detail).
      if (!editId) {
        setDasarSelected((arr) =>
          arr.length ? arr : items.filter((d) => isDasarDefault(d.isi)).map((d) => ({ id: d.id, isi: d.isi }))
        );
      }
    } catch (e) { /* abaikan */ }
  }, [editId]);

  // ---------- muat menimbang global (dikelola Admin / Arsiparis) ----------
  const loadMenimbang = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/dasaraturan', { params: { jenis: 'menimbang' } });
      const items = (res.data?.data || [])
        .filter((d) => d.is_active)
        .sort((a, b) => a.urutan - b.urutan);
      setMenimbangList(items);
    } catch (e) { /* abaikan */ }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadDasar();
      loadMenimbang();
    }
  }, [sessionStatus, loadDasar, loadMenimbang]);

  // ---------- muat daftar katim (untuk select pengajuan) ----------
  const loadKatim = useCallback(async () => {
    setKatimLoading(true);
    try {
      const res = await axiosInstance.get('/keycloak/users/by-role/katim');
      setKatimList(res.data?.data || []);
    } catch (e) {
      // abaikan — biarkan pilihan kosong
    } finally {
      setKatimLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') loadKatim();
  }, [sessionStatus, loadKatim]);

  // ---------- Nama Kepala Balai (default dari Pengaturan) ----------
  // Nilai global dipakai sebagai DEFAULT saat membuat ST BARU. Setelah ST
  // dibuat, namanya tersimpan di ST itu sendiri sehingga tetap "nama lama"
  // ketika pimpinan berganti.
  const [kepalaDefault, setKepalaDefault] = useState('');

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    (async () => {
      try {
        const res = await axiosInstance.get('/pejabat');
        setKepalaDefault(res.data?.data?.kepala_nama || '');
      } catch (e) { /* abaikan — biarkan kosong / diisi manual */ }
    })();
  }, [sessionStatus]);

  // Mode TAMBAH: isi otomatis bila masih kosong (mode edit memakai snapshot ST).
  useEffect(() => {
    if (editId || !kepalaDefault) return;
    setForm((f) => (f.namaKabalai ? f : { ...f, namaKabalai: kepalaDefault }));
  }, [editId, kepalaDefault]);

  // Menimbang selalu diambil dari daftar global admin (read-only, tampil semua);
  // diproses ulang setelah detail ST dimuat agar global selalu menang atas snapshot lama
  useEffect(() => {
    setForm((f) => ({
      ...f,
      menimbangA: menimbangList[0]?.isi ?? f.menimbangA,
      menimbangB: menimbangList[1]?.isi ?? f.menimbangB,
    }));
  }, [menimbangList, editLoaded]);

  // ---------- mode edit ----------
  useEffect(() => {
    if (!editId || sessionStatus !== 'authenticated') return;
    (async () => {
      try {
        const res = await axiosInstance.get(`/surattugas/${editId}`);
        const d = res.data?.data;
        setOrigStatus(d.status);
        setForm({
          kegiatanId: d.kegiatan_id, kegiatanSumber: d.kegiatan_sumber || 'talawang',
          kegiatan: d.kegiatan || '', mak: d.mak || '', kota: d.kota_kab_kecamatan || '',
          tglMulai: d.rencana_tgl_mulai || '', tglSelesai: d.rencana_tgl_selesai || '',
          tanggalSt: d.tanggal_st || '', tempatTerbit: d.tempat_terbit || 'Palangka Raya',
          // Snapshot ST ini; bila belum ada (ST lama) pakai nama global sebagai tampilan awal
          namaKabalai: d.nama_kabalai || d.ttd_kepala_nama || '',
          untuk: d.untuk || '',
          // fallback dari snapshot lama; nanti ditimpa daftar global admin (bila tersedia)
          menimbangA: d.menimbang_a || '', menimbangB: d.menimbang_b || '',
          tanpaSppd: !!d.tanpa_sppd,
          ppkId: d.ppk_id || '', ppkNama: d.ppk_nama || '', ppkNip: d.ppk_nip || '',
          ppkManual: !!d.ppk_manual,
        });
        setEditLoaded(true);
        setDasarSelected((d.dasar || []).map((x) => ({
          id: x.dasar_aturan_id ? Number(x.dasar_aturan_id) : `legacy-${x.id}`,
          isi: x.isi,
        })));
        setPeserta((d.peserta || []).map((p) => {
          const sp = d.sppd?.find((s) => s.peserta_id === p.id) || {};
          return {
            nama: p.nama || '', nip: p.nip || '', pangkat: p.pangkat || '',
            jabatan: p.jabatan || '',
            instansi: p.instansi || INSTANSI, sumber: p.sumber || 'manual',
            sppd: {
              tingkatBiaya: sp.tingkat_biaya || '', alatAngkut: sp.alat_angkut || '',
              tempatBerangkat: sp.tempat_berangkat || 'Palangka Raya',
              tanggalBerangkat: sp.tanggal_berangkat || '', tanggalKembali: sp.tanggal_kembali || '',
            },
          };
        }));
      } catch (e) {
        setError(e.response?.data?.message || 'Gagal memuat surat tugas');
      }
    })();
  }, [editId, sessionStatus]);

  // ---------- cari kegiatan di talawang ----------
  // Hanya tampilkan kegiatan yang sudah layak dipakai utk Surat Tugas
  // (status: diketahui / disetujui / selesai). Draft dll. disembunyikan.
  const KEGIATAN_STATUS_VISIBLE = ['diketahui', 'disetujui', 'selesai'];
  const cariKegiatan = async () => {
    if (!kegiatanQuery.trim()) return;
    setSearchingKegiatan(true);
    setError('');
    try {
      const res = await axiosInstance.get('/talawang/kegiatan', { params: { search: kegiatanQuery.trim() } });
      const semua = res.data?.data || [];
      const list = semua.filter((k) =>
        KEGIATAN_STATUS_VISIBLE.includes(String(k?.status || '').toLowerCase())
      );
      setKegiatanResults(list);
      setKegiatanSearched(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mencari kegiatan di talawang');
    } finally {
      setSearchingKegiatan(false);
    }
  };

  const pilihKegiatan = async (k) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await axiosInstance.get(`/talawang/kegiatan/${k.id}`);
      const d = res.data?.data || {};
      set({
        kegiatanId: d.id, kegiatanSumber: 'talawang',
        kegiatan: d.kegiatan || '', mak: d.mak || '', kota: d.kota_kab_kecamatan || '',
        tglMulai: d.rencana_tanggal_pelaksanaan || '', tglSelesai: d.rencana_tanggal_pelaksanaan_akhir || '',
        // "Untuk" diisi NAMA KEGIATAN apa adanya — TANPA awalan "Mengikuti".
        // (Permintaan user 2026-09-11: awalan itu dulu ditambahkan otomatis.
        //  Kalau perlu, bisa diketik manual di kolom "Untuk" pada form.)
        untuk: d.kegiatan || '',
        ppkId: d.ppk_id || '', ppkNama: d.ppk_nama || '', ppkNip: d.ppk_nip || '', ppkManual: false,
      });
      setKegiatanResults([]);
      setKegiatanQuery('');
      setKegiatanSearched(false);
      // auto peserta dari nominatif
      const pegawai = (d.pegawai || []).filter((p) => p.nama);
      if (pegawai.length) {
        setPeserta(pegawai.map((p, idx) => ({
          nama: p.nama || '', nip: p.nip || '', pangkat: p.pangkat || '',
          jabatan: p.jabatan || '', instansi: INSTANSI, sumber: 'talawang',
          sppd: {
            tingkatBiaya: '', alatAngkut: '', tempatBerangkat: 'Palangka Raya',
            tanggalBerangkat: d.rencana_tanggal_pelaksanaan || '',
            tanggalKembali: d.rencana_tanggal_pelaksanaan_akhir || '',
          },
        })));
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat detail kegiatan');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ---------- peserta helpers ----------
  const updatePeserta = (i, patch) =>
    setPeserta((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const updateSppd = (i, patch) =>
    setPeserta((arr) => arr.map((p, idx) =>
      idx === i ? { ...p, sppd: { ...p.sppd, ...patch } } : p));
  const addPeserta = () => setPeserta((arr) => [...arr, emptyPeserta()]);
  const removePeserta = (i) => setPeserta((arr) => arr.filter((_, idx) => idx !== i));

  const toggleDasar = (item) =>
    setDasarSelected((arr) => {
      const exists = arr.some((x) => x.id === item.id || x.isi === item.isi);
      return exists
        ? arr.filter((x) => x.id !== item.id && x.isi !== item.isi)
        : [...arr, { id: item.id, isi: item.isi }];
    });

  // ---------- validasi & kirim ----------
  const buildPayload = () => ({
    ...form,
    dasar: dasarSelected.map((d) => {
      const src = dasarOptions.find((o) => o.id === d.id || o.isi === d.isi);
      return { id: src ? src.id : null, isi: d.isi };
    }),
    peserta: peserta.map((p) => ({
      nama: p.nama, nip: p.nip, pangkat: p.pangkat,
      jabatan: p.jabatan, instansi: p.instansi, sumber: p.sumber, sppd: p.sppd,
    })),
  });

  const simpan = async () => {
    if (!form.tanggalSt) { setError('Tanggal surat tugas wajib diisi'); return null; }
    if (peserta.length === 0) { setError('Minimal satu peserta'); return null; }
    if (peserta.some((p) => !p.nama.trim())) { setError('Nama peserta wajib diisi'); return null; }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      let id = editId;
      if (editId) {
        await axiosInstance.put(`/surattugas/${editId}`, payload);
      } else {
        const res = await axiosInstance.post('/surattugas', payload);
        id = res.data?.data?.id;
      }
      return id;
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan surat tugas');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSimpanDraft = async () => {
    const id = await simpan();
    if (id) router.push(`/surattugas?id=${id}`);
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
      await axiosInstance.post(`/surattugas/${id}/ajukan`, {
        katimKey: k.user_id,
        katimNama: k.nama,
        katimNip: k.nip || null,
      });
      router.push(`/surattugas?id=${id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal mengirim ke katim');
      setSaving(false);
    }
  };

  const editable = !editId || ['draft', 'dikembalikan'].includes(origStatus);
  if (sessionStatus === 'loading') {
    return <div className="min-h-screen bg-stone-100 dark:bg-zinc-950 flex items-center justify-center text-sm animate-pulse text-zinc-400">Memuat…</div>;
  }

  return (
    <>
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

          {editable && (
            <>
              {/* A. Kegiatan */}
              <Section icon={FaFileSignature} title="1. Kegiatan / Maksud Tugas (sumber: talawang)">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className={inputCls}
                    value={kegiatanQuery}
                    onChange={(e) => setKegiatanQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && cariKegiatan()}
                    placeholder="Cari kegiatan… (mis. nama kegiatan / mak)"
                  />
                  <button
                    onClick={cariKegiatan}
                    disabled={searchingKegiatan}
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {searchingKegiatan ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSearch className="w-4 h-4" />}
                    Cari
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  Hanya kegiatan berstatus{' '}
                  <b className="text-zinc-500 dark:text-zinc-400">diketahui / disetujui / selesai</b> yang
                  ditampilkan (draft tidak dimunculkan). Nominatif milik pegawai lain tetap muncul bila Anda
                  terdaftar sebagai <b className="text-zinc-500 dark:text-zinc-400">peserta</b> di dalamnya.
                </p>

                {kegiatanSearched && !searchingKegiatan && kegiatanResults.length === 0 && !loadingDetail && (
                  <div className="mt-3 rounded-xl border border-dashed border-stone-300 dark:border-zinc-700 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Tidak ada kegiatan yang cocok. Kegiatan hanya muncul bila berstatus{' '}
                    <b>diketahui / disetujui / selesai</b> dan Anda pembuatnya atau terdaftar sebagai peserta
                    nominatifnya. Bila kegiatan belum muncul, isi manual pada bagian di bawah.
                  </div>
                )}

                {kegiatanResults.length > 0 && (
                  <div className="mt-3 rounded-xl border border-stone-200 dark:border-zinc-700 divide-y divide-stone-100 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                    {kegiatanResults.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => pilihKegiatan(k)}
                        className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {k.kegiatan}
                          {k.dari_nominatif && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 align-middle">
                              nominatif orang lain
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {k.kota_kab_kecamatan || ''} · {k.mak || ''}
                          {k.no_st ? ` · No ST: ${k.no_st}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {loadingDetail && (
                  <div className="mt-3 text-sm text-zinc-400 animate-pulse">Memuat detail kegiatan…</div>
                )}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {field('Kegiatan / Maksud', form.kegiatan, (v) => set({ kegiatan: v }), { disabled: !!form.kegiatanId })}
                  {field('Mata Anggaran (MAK)', form.mak, (v) => set({ mak: v }), { disabled: !!form.kegiatanId })}
                  {field('Kota / Tempat Tujuan', form.kota, (v) => set({ kota: v }), { disabled: !!form.kegiatanId })}
                  <div className="grid grid-cols-2 gap-3">
                    {field('Rencana Mulai', form.tglMulai, (v) => set({ tglMulai: v }), { type: 'date', disabled: !!form.kegiatanId })}
                    {field('Rencana Selesai', form.tglSelesai, (v) => set({ tglSelesai: v }), { type: 'date', disabled: !!form.kegiatanId })}
                  </div>
                  <div className="sm:col-span-2">
                    {field('Untuk (otomatis dari kegiatan)', form.untuk, (v) => set({ untuk: v }))}
                  </div>
                </div>
              </Section>

              {/* B. Dasar */}
              <Section icon={FaBookOpen} title="2. Dasar (pilih aturan yang berlaku)">
                {dasarOptions.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Belum ada dasar aturan (global dari Admin maupun milik Anda). Silakan cek menu{' '}
                    <a href="/pengaturan/dasaraturan" className="text-amber-600 font-medium underline">Dasar Aturan</a>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400 -mt-1 mb-1">
                      Mencentang aturan yang dipakai sebagai dasar surat ini.
                    </p>
                    {dasarOptions.map((d) => {
                      const checked = dasarSelected.some((x) => x.id === d.id || x.isi === d.isi);
                      return (
                        <label key={d.id} className={`flex gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${checked ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-stone-200 dark:border-zinc-700'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleDasar(d)} className="mt-0.5 accent-amber-500" />
                          <span className="text-sm text-zinc-700 dark:text-zinc-200 flex-1">
                            {d.isi}
                            {d.is_global && (
                              <span className="ml-2 inline-flex items-center text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full align-middle">
                                Admin
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* C. Data ST */}
              <Section icon={FaFileSignature} title="3. Data Surat Tugas">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field('Tanggal Surat Tugas *', form.tanggalSt, (v) => set({ tanggalSt: v }), { type: 'date' })}
                  {field('Tempat Terbit', form.tempatTerbit, (v) => set({ tempatTerbit: v }))}
                </div>
                <div className="mt-4">
                  {field('Nama Kepala Balai (penandatangan)', form.namaKabalai, (v) => set({ namaKabalai: v }), {
                    placeholder: 'nama lengkap beserta gelar',
                  })}
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Terisi otomatis dari <b>Pengaturan → Pejabat Penandatangan</b> dan bisa diubah di sini.
                    Nama ini <b>disimpan pada ST ini</b>, jadi Surat Tugas, lampiran, dan SPD yang
                    sudah dibuat tetap memakai nama ini walau pimpinan berganti.
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Menimbang — otomatis dari Admin (Arsiparis), tidak dapat diubah
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[
                      { huruf: 'a', teks: form.menimbangA },
                      { huruf: 'b', teks: form.menimbangB },
                    ].map((m) => (
                      <div key={m.huruf} className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <span className="font-semibold mr-1.5">{m.huruf}.</span>
                        {m.teks || '—'}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {/* D. Peserta (+ SPPD opsional) */}
              <Section icon={FaUsers} title={`4. Peserta ${form.tanpaSppd ? '(tanpa SPPD)' : '& SPPD'} (${peserta.length})`}>
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                  <input
                    type="checkbox"
                    checked={!form.tanpaSppd}
                    onChange={(e) => set({ tanpaSppd: !e.target.checked })}
                    className="accent-amber-500"
                  />
                  Terbitkan SPPD (perjalanan dinas)
                  {form.tanpaSppd && (
                    <span className="inline-flex items-center rounded-full bg-stone-100 dark:bg-zinc-800 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 px-2 py-0.5">
                      Tanpa SPPD
                    </span>
                  )}
                </label>
                {peserta.length === 0 && (
                  <p className="text-sm text-zinc-500 mb-4">
                    Belum ada peserta. Pilih kegiatan untuk memuat otomatis dari nominatif, atau tambah manual.
                  </p>
                )}
                <div className="space-y-4">
                  {peserta.map((p, i) => (
                    <div key={i} className="rounded-xl border border-stone-200 dark:border-zinc-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Peserta {i + 1} {p.sumber === 'talawang' ? '· dari nominatif' : ''}
                        </p>
                        <button onClick={() => removePeserta(i)} className="text-red-500 hover:text-red-600 text-xs inline-flex items-center gap-1">
                          <FaTrash className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <NamaPesertaPicker
                          value={p.nama}
                          users={users}
                          loading={usersLoading}
                          onRequestLoad={loadUsers}
                          onChange={(v) => updatePeserta(i, { nama: v })}
                          onPick={(u) => updatePeserta(i, {
                            nama: u.nama || p.nama,
                            nip: u.nip || p.nip,
                            pangkat: u.pangkat || p.pangkat,
                            jabatan: u.jabatan || p.jabatan,
                          })}
                        />
                        {field('NIP', p.nip, (v) => updatePeserta(i, { nip: v }))}
                        {field('Pangkat / Golongan', p.pangkat, (v) => updatePeserta(i, { pangkat: v }), { placeholder: 'mis. Pembina / IV a' })}
                        <div className="sm:col-span-3">
                          {field('Jabatan', p.jabatan, (v) => updatePeserta(i, { jabatan: v }))}
                        </div>
                      </div>

                      {/* SPPD */}
                      {!form.tanpaSppd && (
                      <div className="mt-4 rounded-lg bg-stone-50 dark:bg-zinc-800/60 p-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2.5">
                          Isian SPPD — {p.nama || `Peserta ${i + 1}`}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <label className="block">
                            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Tingkat Biaya</span>
                            <select className={inputCls} value={p.sppd.tingkatBiaya || ''} onChange={(e) => updateSppd(i, { tingkatBiaya: e.target.value })}>
                              <option value="">— pilih —</option>
                              {TINGKAT_BIAYA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </label>
                          <label className="block">
                            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Alat Angkut</span>
                            <select className={inputCls} value={p.sppd.alatAngkut || ''} onChange={(e) => updateSppd(i, { alatAngkut: e.target.value })}>
                              <option value="">— pilih —</option>
                              {ALAT_ANGKUT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </label>
                          {field('Tempat Berangkat', p.sppd.tempatBerangkat, (v) => updateSppd(i, { tempatBerangkat: v }))}
                          {field('Tgl Berangkat', p.sppd.tanggalBerangkat, (v) => updateSppd(i, { tanggalBerangkat: v }), { type: 'date' })}
                          {field('Tgl Kembali', p.sppd.tanggalKembali, (v) => updateSppd(i, { tanggalKembali: v }), { type: 'date' })}
                          <label className="block">
                            <span className="block text-[11px] font-medium text-zinc-500 mb-1">Lama (otomatis)</span>
                            <input className={`${inputCls} bg-stone-100 dark:bg-zinc-800`} readOnly value={hitungLama(p.sppd.tanggalBerangkat || form.tglMulai, p.sppd.tanggalKembali || form.tglSelesai) || '-'} />
                          </label>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-2.5">
                          Tujuan: <b>{form.kota || '—'}</b> · MAK: <b>{form.mak || '—'}</b> (otomatis dari kegiatan)
                        </p>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addPeserta} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-stone-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 hover:border-amber-400">
                  <FaPlus className="w-3.5 h-3.5" /> Tambah peserta manual
                </button>
              </Section>

              {/* E. PPK */}
              <Section icon={FaUsers} title="5. Pejabat Pembuat Komitmen (PPK)">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!form.ppkManual}
                      onChange={(e) => set({ ppkManual: !e.target.checked })}
                      className="accent-amber-500"
                    />
                    Otomatis dari kegiatan {form.ppkNama ? `(${form.ppkNama})` : ''}
                  </label>
                  {form.ppkManual ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {field('Nama PPK', form.ppkNama, (v) => set({ ppkNama: v }))}
                      {field('NIP PPK', form.ppkNip, (v) => set({ ppkNip: v }))}
                      {field('ID PPK', form.ppkId, (v) => set({ ppkId: v }))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        {field('Nama PPK', form.ppkNama, (v) => set({ ppkNama: v }), { disabled: true })}
                      </div>
                      {field('NIP PPK', form.ppkNip, (v) => set({ ppkNip: v }), { disabled: true })}
                    </div>
                  )}
                </div>
              </Section>

              {/* 6. Katim Tujuan (untuk pengajuan) */}
              <Section icon={FaUserShield} title="6. Katim Tujuan (untuk pengajuan)">
                <label className="block">
                  <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Pilih Katim *</span>
                  <select
                    className={inputCls}
                    value={selectedKatim}
                    onChange={(e) => setSelectedKatim(e.target.value)}
                  >
                    <option value="">— pilih katim —</option>
                    {katimList.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.nama}{u.nip ? ` · NIP ${u.nip}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {katimLoading && (
                  <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5">
                    <FaSpinner className="w-3 h-3 animate-spin" /> Memuat daftar katim…
                  </p>
                )}
                <p className="text-xs text-zinc-400 mt-1.5">
                  Katim ini yang akan memverifikasi saat tombol "Simpan & Ajukan ke Katim" ditekan.
                </p>
              </Section>
            </>
          )}

          {/* Tombol simpan */}
          {editable && (
            <div className="fixed bottom-0 inset-x-0 lg:left-64 lg:right-0 z-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-t border-stone-200 dark:border-zinc-800 px-4 sm:px-6 py-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => handleSimpanDraft()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
                  Simpan Draft
                </button>
                <button
                  onClick={() => handleSimpanAjukan()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-zinc-900 px-4 py-2.5 text-sm font-semibold hover:bg-amber-300 disabled:opacity-50"
                >
                  {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaPaperPlane className="w-4 h-4" />}
                  Simpan & Ajukan ke Katim
                </button>
              </div>
            </div>
          )}
        </div>
    </>
  );
}
