// components/surattugas/CetakSPD.js — Halaman cetak SPD (Surat Perintah Dinas / SPPD)
// ?jenis=sppd&sppd=<id> -> SPD pegawai tertentu | tanpa sppd -> semua SPD (page-break tiap lembar)
//
// SENGAJA DIPISAH dari CetakSuratTugas.js supaya perubahan layout SPD tidak
// menyentuh Surat Tugas (dan sebaliknya).
// Ketentuan SPD: TANPA gambar kop & TANPA footer, kepala berupa DUA KOTAK,
// ukuran huruf 10pt, margin atas 3cm / bawah 2cm / kiri 3cm / kanan 2cm.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaSpinner, FaFilePdf } from 'react-icons/fa';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Kepala SPD (dua kotak). Ubah konstanta ini bila instansi berubah.
// CATATAN: baris "Kode Nomor" TIDAK lagi memakai konstanta kode klasifikasi —
// kini diisi NOMOR SURAT TUGAS (data.nomor_st), permintaan user 2026-09-11.
const SPD_INSTANSI = 'BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA';

// Nama Kepala Balai (halaman 2 SPD) — CADANGAN TERAKHIR saja.
// Urutan yang dipakai saat cetak:
//   1. data.nama_kabalai    → snapshot pada ST ini (diisi di form / migrasi 009)
//   2. data.ttd_kepala_nama → setting global Pengaturan → Pejabat Penandatangan
//   3. konstanta di bawah   → hanya bila keduanya kosong
const TTD_KEPALA_NAMA = 'Ali Yudhi Hartanto, SF., Apt., MM';

function tanggalPanjang(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7e5e4; }
  /* ============ LEMBAR SPD ============
     Kertas Legal: 21,59 cm × 35,56 cm.
     Margin cetak: atas 3cm, kanan 2cm, bawah 2cm, kiri 3cm.
     Seluruh isi SPD 10pt (kecuali judul 12pt). */
  .print-sheet {
    /* lebar blok kanan (Dikeluarkan di + tanda tangan) — ubah satu angka ini
       untuk menggeser keduanya bersama-sama.
       50% = kolom kiri & kanan sama besar (permintaan user). */
    --blok-kanan: 50%;
    /* HALAMAN 2: lebar kolom KANAN (realisasi perjalanan + ttd Kepala Balai).
       Kiri otomatis mengambil sisanya (dan memang KOSONG, jadi tidak ada
       yang dikorbankan bila kolom kanan dilebarkan).
       58% dipilih supaya baris "Kepala Balai Besar Pengawas Obat dan Makanan"
       tetap 1 BARIS dengan sisa ruang yang aman.
       Diukur (Chrome, white-space:nowrap): lebar ASLI teks itu 85,28mm,
       jadi butuh kotak minimal 85,28 + padding 2mm x2 = 89,28mm = 53,8%.
       Pada 50% (isi 78,8mm) → 2 baris; 55% (87,1mm) sudah 1 baris tapi sisa
       hanya 1,8mm; 59% → isi 93,2mm (sisa 8mm) ✔.
       Kenapa tidak lebih lebar lagi? Karena lebar kertas tetap: konten 165,9mm.
       Kolom kanan butuh ≥ 89,8mm (judul di atas) dan kolom KIRI butuh ≥ 66,3mm
       supaya "Pada Tanggal : 10 September 2026" tetap 1 baris (label 24mm +
       titik dua 4mm + tanggal 33,79mm + padding/border 4,53mm) — 89,8+66,3 =
       156,1mm, jadi batas atas kolom kanan ± 60% (99,4mm). Dipakai 59%
       (97,7mm) supaya kolom kiri masih punya sisa ± 1,6mm.
       Ubah HANYA angka ini bila perlu lebih lebar/sempit lagi. */
    --spd2-kanan: 59%;
    position: relative;
    width: 215.9mm;
    min-height: 355.6mm;
    margin: 10mm auto;
    padding: 30mm 20mm 20mm 30mm;
    background: #fff;
    font-family: 'Bookman Old Style', 'Bookman', Georgia, 'Times New Roman', serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.15;
  }
  /* Judul dokumen — 12pt, bold, huruf besar.
     Jarak: 8mm dari kepala (diatur margin-bottom .spd-kop) dan 8mm ke tabel isi
     (diatur margin-top .spd-table) supaya tidak terlalu rapat. */
  .judul {
    text-align: center;
    font-weight: normal !important;
    font-family: 'Bookman Old Style', 'Bookman', Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1;
    margin: 0;
    text-transform: uppercase;
  }
  .judul-bold { font-weight: bold !important; }
  .blok { margin-bottom: 3.5mm; }
  /* Kepala SPD: DUA KOTAK bergaris — kiri nama instansi (rata tengah kiri-kanan & atas-bawah),
     kanan Lembar Ke / Kode Nomor / Nomor (rata kiri).
     Lebar 55% / 45% supaya baris "Kode Nomor : <nomor surat tugas>" tetap 1 baris.
     Nomor ST asli ±15–20 karakter (mis. "KP.01.01.0156.26.222") — muat di 70,7mm. */
  .spd-kop { width: 100%; border-collapse: collapse; margin-bottom: 8mm; table-layout: fixed; }
  .spd-kop td {
    border: 1px solid #000;
    padding: 1.5mm 2mm;
    vertical-align: top;
    font-size: 10pt;
    line-height: 1.2;
  }
  .spd-kop .kop-kiri { width: 55%; text-align: center; vertical-align: middle; }
  .spd-kop .kop-kanan { width: 45%; }
  .spd-table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
  /* padding VERTIKAL 1mm — JANGAN dinaikkan lagi tanpa mengukur ulang.
     Sebab: seluruh isi halaman 1 harus muat dalam satu lembar Legal
     (355,6mm). Dengan padding 2mm, isi halaman 1 = 366mm → LUBER 10,5mm
     sehingga tabel tanda tangan terdorong ke halaman baru saat di-PDF-kan
     (di layar tidak terlihat karena lembar hanya memanjang).
     Diukur: padding 1mm → isi ±326mm (muat, sisa ±30mm; data panjang ±342mm).
     Bila perlu diubah, ukur dulu tinggi isi halaman 1 (Chrome headless +
     getBoundingClientRect) sebelum menaikkan nilainya. */
  .spd-table td { border: 1px solid #000; padding: 1mm 2.5mm; vertical-align: top; }
  .spd-table .no { width: 6mm; text-align: center; }
  /* Lebar kolom (permintaan user): no 6mm, label 75mm, isi 90mm.
     Total 171mm sedikit melebihi lebar konten (215,9 − 30 − 20 = 165,9mm), sehingga
     browser menskalakan proporsinya agar tabel tetap selebar halaman (tidak meluber). */
  .spd-table .c-label { width: 75mm; }
  .spd-table .c-isi { width: 90mm; }
  /* HALAMAN 2 SPD — tabel 2 kolom, 7 BARIS.
     Baris 1: KIRI kosong | KANAN = realisasi keberangkatan + ttd Kepala Balai.
     Baris 2: KIRI = blok "Tiba di" (terisi) | KANAN = blok "Berangkat dari" (terisi).
     Baris 3 & 4: label sama seperti baris 2, tetapi NILAINYA KOSONG (kotak isian kosong).
     Baris 5: KIRI = "Tiba Kembali" + ttd PPK | KANAN = pernyataan "Telah diperiksa …" + ttd PPK.
     Baris 6: 2 sel KOSONG dengan tinggi TIPIS (7mm) — lihat .spd2-tipis di bawah.
     Baris 7: 2 kolom DIGABUNG jadi 1 sel (colSpan=2) = catatan PERHATIAN —
              tingginya mengikuti isi (± 24,5mm) — lihat .spd2-gabung.
     Kelas kolom yang sama dipakai di semua baris supaya batas kolom & titik dua
     SEJAJAR. Diberi GARIS sementara supaya batas kolom terlihat saat pengecekan. */
  .spd2-kolom { width: 100%; border-collapse: collapse; margin-top: 6mm; table-layout: fixed; }
  /* Tinggi dasar 40mm (BUKAN 50mm lagi). Alasannya: ruang sisa halaman 2 hanya
     8,2mm sedangkan baris PERHATIAN (baris 7) butuh 24,5mm → perlu ± 24mm, dan
     satu-satunya sumber ruang adalah 3 baris KOSONG (baris 2-4) ini.
     50 → 40mm × 3 baris = 30mm. Baris 1 & 5 TIDAK terpengaruh karena tingginya
     ditentukan isinya (80,7mm dan 60,6mm); baris 6 & 7 punya override sendiri.
     Kalau baris kosong mau kembali 50mm: angka ini dikembalikan TAPI baris
     PERHATIAN akan melompat ke halaman berikutnya. */
  .spd2-kolom td { border: 1px solid #000; height: 40mm; vertical-align: top; padding: 2mm; }
  /* Baris PERHATIAN (baris terakhir) — satu sel hasil gabungan 2 kolom, jadi
     tingginya HARUS mengikuti isi; tanpa ini sel kena height 40mm di atas. */
  .spd2-kolom tr.spd2-gabung > td { height: auto; }
  /* BARIS TIPIS (ke-6) = 2 sel KOSONG setinggi 7mm (permintaan user 2026-09-11:
     "tambahkan 2 kolom kosong, tapi tingginya tipis saja").
     UKUR: ruang sisa halaman 2 hanya 8,2mm (baris 1 = 80,7mm & baris 5 = 60,6mm
     karena isinya, sedangkan baris 2-4 masing-masing 50mm + margin tabel 6mm +
     padding lembar 30+20mm). Tinggi 8mm masih muat (sisa 0,2mm), 9mm LUBER →
     PDF jadi 2 halaman. Dipakai 7mm supaya masih ada cadangan 1,2mm.
     Ubah HANYA angka 7mm ini bila perlu lebih tebal/tipis. */
  .spd2-kolom tr.spd2-tipis > td { height: 7mm; }
  /* kolom kiri = sisa lebar, kolom kanan = var(--spd2-kanan) (lihat .print-sheet) */
  .spd2-kolom .spd2-kiri { width: calc(100% - var(--spd2-kanan)); }
  .spd2-kolom .spd2-kanan { width: var(--spd2-kanan); }
  /* baris "Berangkat dari : …" dan "Pada Tanggal : …" — titik dua sejajar.
     Lebar label DIUKUR (Chrome, Bookman 10pt): "Pada Tanggal" 23,07mm,
     "Berangkat dari" 25,82mm, "Tiba Kembali" 22,64mm, "Tiba di" 11,85mm.
     Label dipisah per kolom karena kolom kiri lebih sempit dan labelnya memang
     lebih pendek: 24mm untuk KIRI (cukup utk "Pada Tanggal"/"Tiba Kembali"),
     27mm untuk KANAN (butuh "Berangkat dari"). Sisa lebar sel jadi ruang NILAI
     — inilah yang membuat "Pada Tanggal : 10 September 2026" (33,79mm) tetap
     1 baris di kedua kolom. Jangan disamakan jadi 28mm lagi. */
  .spd2-baris { display: flex; }
  .spd2-label { width: 28mm; flex: none; }
  .spd2-kolom .spd2-kiri .spd2-label { width: 24mm; }
  .spd2-kolom .spd2-kanan .spd2-label { width: 27mm; }
  .spd2-colon { width: 4mm; flex: none; }
  /* Sel baris 5 (yang berisi blok ttd PPK) — dibuat SEJAJAR semuanya:
     (1) Kedua sel diratakan ATAS (bawaan .spd2-kolom td) supaya baris pertama
         kiri "Tiba Kembali" dan kanan "Telah diperiksa …" SEJAJAR.
     (2) Isi di atas blok ttd kolom KIRI lebih pendek daripada kolom KANAN
         (2 baris label vs paragraf "Telah diperiksa …" 4 baris), jadi blok ttd
         KIRI digeser turun agar judul "Pejabat Pembuat Komitmen" & nama PPK
         juga SEJAJAR (permintaan user 2026-09-11).
     PENTING: div judul di dalam .ttd-blok punya margin-top 8mm sendiri, dan
     margin itu MENYATU (margin collapse) dengan margin milik .ttd-blok —
     jadi angka di sini adalah JARAK TOTAL dari baris label terakhir ke judul,
     bukan tambahan. Nilai 16,1mm = 8,1mm kekurangan + 8mm margin bawaan judul.
     Angka hasil UKUR (puppeteer) pada keadaan sekarang (--spd2-kanan 59%):
     selisih baris pertama, judul, dan nama = 0mm.
     Angka ini IKUT BERUBAH bila --spd2-kanan diubah (jumlah baris paragraf
     "Telah diperiksa …" bisa berubah 4↔5 baris, tiap baris 4,06mm) — UKUR ULANG.
     JANGAN memakai display:flex pada <td> — sel tidak lagi dianggap table-cell
     sehingga lebar kolom table-layout:fixed kolaps. Cukup vertical-align + margin. */
  .spd2-kolom td.spd2-kiri.spd2-ttd .ttd-blok { margin-top: 16.1mm; }
  /* Dikeluarkan di / Pada Tanggal — blok di KANAN, TANPA garis tabel (sudah rapi).
     Lebarnya sama dengan --blok-kanan supaya tanda tangan di bawahnya sejajar. */
  .spd-terbit { width: var(--blok-kanan); margin-left: auto; border-collapse: collapse; table-layout: fixed; }
  .spd-terbit td { border: none; padding: 0.5mm 1.5mm; vertical-align: top; }
  .spd-terbit .t-label { width: 35mm; }   /* dilebarkan agar "Dikeluarkan di" tetap 1 baris */
  .spd-terbit .t-colon { width: 4mm; text-align: center; }
  /* Tanda tangan — 2 kolom: KIRI kosong, KANAN untuk ttd (rata kiri).
     TANPA garis kolom (permintaan user); lebar kiri & kanan sama (50% : 50%). */
  .ttd-table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
  .ttd-table td { border: none; padding: 0; vertical-align: top; }
  /* kolom kiri dikosongkan = sisa halaman, sehingga ttd mulai PERSIS sejajar "Dikeluarkan di" */
  .ttd-kiri { width: calc(100% - var(--blok-kanan)); }
  .ttd-blok { text-align: left; }
  /* Baris variabel ttd — rata kiri indentasi 5 spasi, dibuat "polos"
     (tanpa kerning/ligatur/letter-spacing) supaya variabel tetap satu kesatuan. */
  .ttd-blok .ttd-pengirim {
    margin-top: 16mm;
    padding-left: 5ch;
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: normal;
    word-spacing: normal;
    text-rendering: geometricPrecision;
  }
  .ttd-blok .nama { margin-top: 20mm; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; }
  .toolbar button { border: none; border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
  .toolbar-pesan { text-align: center; color: #b91c1c; font-family: system-ui, sans-serif; font-size: 13px; padding: 0 12px 10px; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .print-sheet { margin: 0; width: auto; box-shadow: none; }
    .page-break { page-break-after: always; }
    /* next-route-announcer (elemen bawaan Next.js) bisa memaksa halaman kosong */
    next-route-announcer { display: none !important; }
    /* Legal: 215.9mm × 355.6mm — margin kertas 0 (margin diatur via padding .print-sheet) */
    @page { size: 215.9mm 355.6mm; margin: 0; }
  }
`;

export default function CetakSPD() {
  const router = useRouter();
  const { id, sppd } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyPdf, setBusyPdf] = useState(false); // sedang membuat PDF di server
  const [pesanPdf, setPesanPdf] = useState('');   // pesan bila pembuatan PDF gagal

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await axiosInstance.get(`/surattugas/${id}`);
        setData(res.data?.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Tanpa parameter sppd → semua SPD pada ST ini dicetak (1 lembar per pegawai)
  const sppdList = (data?.sppd || []).filter((s) => !sppd || String(s.id) === String(sppd));

  /* Unduh PDF. HTML halaman ini dikirim ke backend lalu dicetak di sana
     memakai Chrome headless (agar hasil PDF konsisten). */
  const unduhPdf = async () => {
    if (busyPdf) return;
    setBusyPdf(true);
    setPesanPdf('');
    try {
      // src gambar dijadikan absolut supaya bisa dimuat Chrome di backend
      document.querySelectorAll('img').forEach((img) => { img.src = img.src; });
      const luarHtml = document.documentElement.outerHTML
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<next-route-announcer>[\s\S]*?<\/next-route-announcer>/gi, '');
      const html = `<!doctype html>${luarHtml}`;
      const nomor = String(data?.nomor_st || '').trim();
      const satu = sppdList.length === 1 ? String(sppdList[0].nomor_sppd || '').trim() : '';
      const nama = `SPD-${nomor || id}${satu ? `-${satu}` : ''}`.replace(/[\\/:*?"<>|]/g, '-');

      const res = await axiosInstance.post('/surattugas/pdf', { html, namaFile: nama }, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${nama}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) {
      setPesanPdf('Gagal membuat PDF: ' + (e.response?.data?.message || e.message || 'tidak diketahui'));
    } finally {
      setBusyPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-200 flex items-center justify-center gap-2 text-zinc-500">
        <FaSpinner className="w-5 h-5 animate-spin" /> Memuat dokumen…
      </div>
    );
  }
  if (error || !data) {
    return <div className="min-h-screen bg-stone-200 flex items-center justify-center text-red-500">{error || 'Tidak ditemukan'}</div>;
  }

  return (
    <>
      <Head><title>Cetak SPD | ECIPAR POM</title></Head>
      <style>{CSS}</style>
      <div className="toolbar">
        <button onClick={unduhPdf} disabled={busyPdf} style={{ background: '#18181b', color: '#fde68a', opacity: busyPdf ? 0.6 : 1, cursor: busyPdf ? 'wait' : 'pointer' }}>
          {busyPdf
            ? <><FaSpinner style={{ display: 'inline' }} className="animate-spin" /> Membuat PDF…</>
            : <><FaFilePdf style={{ display: 'inline' }} /> Unduh PDF{sppdList.length > 1 ? ` (${sppdList.length} SPD)` : ''}</>}
        </button>
        <button onClick={() => window.close()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Tutup
        </button>
      </div>
      {pesanPdf && <div className="toolbar-pesan">{pesanPdf}</div>}

      {sppdList.map((s, i) => (
        <div key={s.id}>
          {/* Halaman belakang hanya SEKALI (di SPD terakhir) walau SPD-nya banyak */}
          <DokumenSPD data={data} sppd={s} halaman2={i === sppdList.length - 1} />
          {i < sppdList.length - 1 && <div className="page-break" />}
        </div>
      ))}
    </>
  );
}

/* ==================== SPD (per pegawai) ====================
   `halaman2` = halaman belakang (realisasi perjalanan + ttd Kepala Balai).
   Diisi `false` bila halaman belakang hanya perlu dicetak SEKALI untuk
   beberapa pegawai (mis. 2 pegawai → 2 halaman depan, 1 halaman belakang). */
export function DokumenSPD({ data, sppd, halaman2 = true }) {
  const instansi = sppd.instansi || 'Balai Besar POM di Palangka Raya';
  // Nama PPK tanpa bagian NIP (dipakai di blok tanda tangan baris ke-5 halaman 2)
  const namaPpk = (sppd.ppk_nama || data.ppk_nama || '').split(' / ')[0];
  return (
    <>
      {/* ==================== HALAMAN 1 ==================== */}
      <div className="print-sheet">
      {/* Kepala SPD: dua kotak (tanpa gambar kop) — kiri instansi, kanan Lembar Ke/Kode Nomor/Nomor */}
      <table className="spd-kop">
        <tbody>
          <tr>
            <td className="kop-kiri">{SPD_INSTANSI}</td>
            <td className="kop-kanan">
              <div>Lembar Ke :</div>
              {/* Kode Nomor diisi NOMOR SURAT TUGAS (permintaan user 2026-09-11) */}
              <div>Kode Nomor : {data.nomor_st || ''}</div>
              <div>Nomor : {sppd.nomor_sppd || ''}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="judul judul-bold">SURAT PERINTAH DINAS (SPD)</div>

      <table className="spd-table">
        <tbody>
          <tr>
            <td className="no">1.</td>
            <td className="c-label">Pejabat Pembuat Komitmen</td>
            <td className="c-isi">{sppd.ppk_nama || data.ppk_nama || ''}</td>
          </tr>
          <tr>
            <td className="no">2.</td>
            <td className="c-label">Nama/NIP Pegawai Yang Melaksanakan Perjalanan Dinas</td>
            <td className="c-isi">{sppd.nama || ''}{sppd.nip ? ` / ${sppd.nip}` : ''}</td>
          </tr>
          {/* Pangkat / Jabatan / Tingkat — masing-masing barisnya SENDIRI (tidak digabung 1 sel) */}
          <tr>
            <td className="no" rowSpan="3">3.</td>
            <td className="c-label">a) Pangkat/Golongan</td>
            <td className="c-isi">{sppd.pangkat || ''}</td>
          </tr>
          <tr>
            <td className="c-label">b) Jabatan/Instansi</td>
            <td className="c-isi">{sppd.jabatan || ''} / {instansi}</td>
          </tr>
          <tr>
            <td className="c-label">c) Tingkat Biaya Perjalanan Dinas</td>
            <td className="c-isi">{sppd.tingkat_biaya || ''}</td>
          </tr>
          <tr>
            <td className="no">4.</td>
            <td className="c-label">Maksud Perjalanan Dinas</td>
            {/* SAMA dengan kolom "Untuk" pada Surat Tugas — dua-duanya memakai `untuk`.
                Sejak 2026-09-11 awalan "Mengikuti" TIDAK lagi ditambahkan otomatis saat
                membuat ST (lihat FormSuratTugas.pilihKegiatan), jadi di sini pun tidak ada
                tambahan otomatis: `untuk` didahulukan, cadangannya `kegiatan`.
                ST lama yang terlanjur menyimpan "Mengikuti testing" tetap tercetak apa
                adanya karena teks itu tersimpan di kolom `untuk`. */}
            <td className="c-isi">{data.untuk || data.kegiatan || ''}</td>
          </tr>
          <tr>
            <td className="no">5.</td>
            <td className="c-label">Alat angkut yang dipergunakan</td>
            <td className="c-isi">{sppd.alat_angkut === 'udara' ? 'Angkutan Udara' : sppd.alat_angkut === 'darat' ? 'Angkutan Darat' : ''}</td>
          </tr>
          {/* Tempat berangkat / tujuan — tiap sub-item baris sendiri */}
          <tr>
            <td className="no" rowSpan="2">6.</td>
            <td className="c-label">a. Tempat Berangkat</td>
            <td className="c-isi">{sppd.tempat_berangkat || ''}</td>
          </tr>
          <tr>
            <td className="c-label">b. Tempat Tujuan</td>
            <td className="c-isi">{sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</td>
          </tr>
          {/* Lama perjalanan / tanggal berangkat / tanggal kembali — tiap sub-item baris sendiri */}
          <tr>
            <td className="no" rowSpan="3">7.</td>
            <td className="c-label">a. Lama Perjalanan Dinas</td>
            <td className="c-isi">{sppd.lama_perjalanan || ''}</td>
          </tr>
          <tr>
            <td className="c-label">b. Tanggal Berangkat</td>
            <td className="c-isi">{sppd.tanggal_berangkat ? tanggalPanjang(sppd.tanggal_berangkat) : ''}</td>
          </tr>
          <tr>
            <td className="c-label">c. Tanggal harus kembali/tiba di tempat baru *)</td>
            <td className="c-isi">{sppd.tanggal_kembali ? tanggalPanjang(sppd.tanggal_kembali) : ''}</td>
          </tr>
          {/* Pengikut — nomor 1.–5. di kolom kiri; hanya kolom Tanggal Lahir yang tersisa.
              Jarak "Pengikut" ke "Nama" = 7mm (span kosong selebar 7mm). */}
          <tr>
            <td className="no">8.</td>
            <td className="c-label">
              Pengikut<span style={{ display: 'inline-block', width: '20mm' }} />Nama
            </td>
            <td className="c-isi">Tanggal Lahir</td>
          </tr>
          {[1, 2, 3, 4, 5].map((n) => (
            <tr key={n} style={{ height: '7mm' }}>
              <td className="no" />
              <td className="c-label">{n}.</td>
              <td className="c-isi" />
            </tr>
          ))}
          {/* Pembebanan anggaran — tiap sub-item baris sendiri */}
          <tr>
            <td className="no" rowSpan="3">9.</td>
            <td className="c-label">Pembebanan Anggaran</td>
            <td className="c-isi" />
          </tr>
          <tr>
            <td className="c-label">a. Instansi</td>
            <td className="c-isi">{instansi}</td>
          </tr>
          <tr>
            <td className="c-label">b. Mata Anggaran</td>
            <td className="c-isi">{sppd.mata_anggaran || data.mak || ''}</td>
          </tr>
          <tr>
            <td className="no">10.</td>
            <td className="c-label">Keterangan Lain-lain</td>
            <td className="c-isi">{sppd.keterangan_lain || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Dikeluarkan di / Pada Tanggal — diletakkan di KANAN, tabel TANPA garis */}
      <div className="blok" style={{ marginTop: '6mm' }}>
        <table className="spd-terbit">
          <tbody>
            <tr>
              <td className="t-label">Dikeluarkan di</td>
              <td className="t-colon">:</td>
              <td>{data.tempat_terbit || 'Palangka Raya'}</td>
            </tr>
            <tr>
              <td className="t-label">Pada Tanggal</td>
              <td className="t-colon">:</td>
              <td>{data.tanggal_st ? tanggalPanjang(data.tanggal_st) : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tanda tangan — 2 kolom: kiri kosong, kanan untuk ttd (rata kiri), seperti Surat Tugas */}
      <table className="ttd-table">
        <tbody>
          <tr>
            <td className="ttd-kiri" />
            <td className="ttd-blok">
              <div>Pembuat Komitmen,</div>
              {/* Variabel Srikandi untuk SPD/SPPD — lihat catatan di CetakSuratTugas.js */}
              <div className="ttd-pengirim">{'${ttd_pengirim2}'}</div>
              <div className="nama">{(sppd.ppk_nama || data.ppk_nama || '').split(' / ')[0]}</div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {halaman2 && (
        <>
      {/* ==================== HALAMAN 2 ==================== */}
      <div className="page-break" />

      <div className="print-sheet">
        {/* Halaman 2: kolom KIRI kosong, kolom KANAN berisi realisasi + ttd Kepala Balai.
             Lebar kolom kanan diatur oleh --spd2-kanan di .print-sheet.
             BARIS KE-2 = 2 kolom KOSONG (di bawah), ditambahkan 2026-09-11. */}
        <table className="spd2-kolom">
          <tbody>
            <tr>
              <td className="spd2-kiri" />
              <td className="spd2-kanan">
                {/* Realisasi perjalanan */}
                <div className="spd2-baris">
                  <span className="spd2-label">Berangkat dari</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tempat_berangkat || ''}</span>
                </div>
                <div>(Tempat Kedudukan)</div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tanggal_berangkat ? tanggalPanjang(sppd.tanggal_berangkat) : ''}</span>
                </div>
                <div>Ke {sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</div>

                {/* Tanda tangan Kepala Balai — rata kiri (kelas .ttd-blok) */}
                <div className="ttd-blok">
                  <div style={{ marginTop: '8mm' }}>Kepala Balai Besar Pengawas Obat dan Makanan</div>
                  <div>di Palangka Raya</div>
                  {/* Variabel Srikandi untuk tanda tangan Kepala Balai */}
                  <div className="ttd-pengirim">{'${ttd_pengirim1}'}</div>
                  <div className="nama">{data.nama_kabalai || data.ttd_kepala_nama || TTD_KEPALA_NAMA}</div>
                </div>
              </td>
            </tr>
            {/* Baris ke-2 — DIISI sesuai permintaan user 2026-09-11:
                 KIRI  : "Tiba di : <tujuan>"  +  "Pada Tanggal : <tgl berangkat>"
                 KANAN : "Berangkat dari : <tujuan>"  +  "Ke : (kosong)"  +  "Pada Tanggal : (kosong)"
                 Kelas .spd2-kiri/.spd2-kanan + .spd2-baris dipakai lagi supaya
                 batas kolom DAN titik duanya sejajar dengan baris 1.
                 Nilai "Ke" & "Pada Tanggal" di kolom kanan memang sengaja dikosongkan. */}
            <tr>
              <td className="spd2-kiri">
                <div className="spd2-baris">
                  <span className="spd2-label">Tiba di</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</span>
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tanggal_berangkat ? tanggalPanjang(sppd.tanggal_berangkat) : ''}</span>
                </div>
              </td>
              <td className="spd2-kanan">
                <div className="spd2-baris">
                  <span className="spd2-label">Berangkat dari</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</span>
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Ke</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
              </td>
            </tr>
            {/* Baris ke-3 & ke-4 — 4 kotak itu DIISI label yang sama seperti baris 2,
                 tetapi NILAINYA KOSONG (kolom isian kosong), permintaan user 2026-09-11:
                   KIRI  : "Tiba di :"  +  "Pada Tanggal :"      (nilai kosong)
                   KANAN : "Berangkat dari :" + "Ke :" + "Pada Tanggal :"  (nilai kosong)
                 Baris 1 & 2 TIDAK diubah. Kelas yang sama dipakai supaya batas kolom
                 dan titik duanya tetap sejajar dengan baris di atasnya. */}
            <tr>
              <td className="spd2-kiri">
                <div className="spd2-baris">
                  <span className="spd2-label">Tiba di</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
              </td>
              <td className="spd2-kanan">
                <div className="spd2-baris">
                  <span className="spd2-label">Berangkat dari</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Ke</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
              </td>
            </tr>
            <tr>
              <td className="spd2-kiri">
                <div className="spd2-baris">
                  <span className="spd2-label">Tiba di</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
              </td>
              <td className="spd2-kanan">
                <div className="spd2-baris">
                  <span className="spd2-label">Berangkat dari</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Ke</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span />
                </div>
              </td>
            </tr>
            {/* Baris ke-5 — ditambahkan 2026-09-11 (permintaan user "tambahkan 2 kolom ke bawah").
                 KIRI : "Tiba Kembali : <tempat berangkat>" + "Pada Tanggal : <tgl kembali>"
                        lalu blok ttd Pejabat Pembuat Komitmen + nama PPK.
                 KANAN: pernyataan "Telah diperiksa dengan Keterangan bahwa …"
                        lalu blok ttd Pejabat Pembuat Komitmen, + nama PPK.
                 CATATAN: belum ada variabel Srikandi di sini — tambahkan bila perlu
                 (mis. ttd_pengirim2 di atas namanya, seperti halaman 1).
                 Baris 1-4 TIDAK diubah. */}
            <tr>
              <td className="spd2-kiri spd2-ttd">
                <div className="spd2-baris">
                  <span className="spd2-label">Tiba Kembali</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tempat_berangkat || 'Palangka Raya'}</span>
                </div>
                <div className="spd2-baris">
                  <span className="spd2-label">Pada Tanggal</span>
                  <span className="spd2-colon">:</span>
                  <span>{sppd.tanggal_kembali ? tanggalPanjang(sppd.tanggal_kembali) : ''}</span>
                </div>
                <div className="ttd-blok">
                  <div style={{ marginTop: '8mm' }}>Pejabat Pembuat Komitmen</div>
                  <div className="nama">{namaPpk}</div>
                </div>
              </td>
              <td className="spd2-kanan spd2-ttd">
                <div>
                  {'Telah diperiksa dengan Keterangan bahwa perjalanan dinas tersebut diatas benar-benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.'}
                </div>
                <div className="ttd-blok">
                  <div style={{ marginTop: '8mm' }}>Pejabat Pembuat Komitmen,</div>
                  <div className="nama">{namaPpk}</div>
                </div>
              </td>
            </tr>
            {/* Baris ke-6 — 2 SEL KOSONG dengan tinggi TIPIS (permintaan user
                 2026-09-11 "tambahkan 2 kolom kosong, tapi tingginya tipis saja").
                 Tinggi diatur .spd2-kolom tr.spd2-tipis > td (7mm) — jangan naikkan
                 di atas 8mm, halaman 2 akan lompat jadi 2 halaman. */}
            <tr className="spd2-tipis">
              <td className="spd2-kiri" />
              <td className="spd2-kanan" />
            </tr>
            {/* Baris ke-7 — 2 kolom DIGABUNG jadi 1 (colSpan=2) berisi catatan
                 PERHATIAN (permintaan user 2026-09-11). Tinggi mengikuti isi
                 (± 24,5mm = 1 baris judul + paragraf 4 baris). */}
            <tr className="spd2-gabung">
              <td colSpan={2}>
                <div>PERHATIAN :</div>
                <div>Pejabat yang berwenang memberikan SPPD, pegawai yang melakukan perjalanan dinas, para pejabat yang mensahkan tanggal berangkat/tiba, serta bendaharawan bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara, apabila negara menerima rugi akibat keselahan, kelalaian dan kealpaan</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
        </>
      )}
    </>
  );
}
