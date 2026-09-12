// components/surattugas/CetakSuratTugas.js — Halaman cetak SURAT TUGAS (+ lampiran peserta)
// ?jenis=st (default) -> Surat Tugas; bila peserta > 1 orang ditambah halaman lampiran (landscape)
// Halaman cetak SPD/SPPD ada di file TERPISAH: components/surattugas/CetakSPD.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaSpinner, FaFilePdf } from 'react-icons/fa';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Pejabat penandatangan ST — CADANGAN TERAKHIR saja.
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

// NIP 18 digit → format resmi "XXXXXXXX XXXXXX X XXX".
// Nilai yang sudah berspasi / panjangnya bukan 18 digit dibiarkan apa adanya.
function formatNip(nip) {
  const s = String(nip || '').trim();
  const digit = s.replace(/\s/g, '');
  if (/^\d{18}$/.test(digit)) {
    return `${digit.slice(0, 8)} ${digit.slice(8, 14)} ${digit.slice(14, 15)} ${digit.slice(15, 18)}`;
  }
  return s;
}

/* Kode variabel tanda tangan untuk Srikandi (dipakai pada cetak Surat Tugas):
     - ST yang memakai SPPD  → ttd_pengirim1
     - ST tanpa SPPD         → ttd_pengirim
   Ditulis sebagai string berkutip satu supaya TIDAK dianggap interpolasi JS/CSS. */
function kodeTtd(data) {
  return data?.tanpa_sppd ? '${ttd_pengirim}' : '${ttd_pengirim1}';
}

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7e5e4; }
  .print-sheet {
    /* Kertas Legal: 21.59 cm × 35.56 cm */
    position: relative; /* acuan penempatan gambar footer */
    width: 215.9mm;
    min-height: 355.6mm;
    margin: 10mm auto;
    /* Batas tepi (kiri 3cm, kanan 2cm); atas/bawah disesuaikan */
    padding: 6mm 20mm 25mm 30mm;
    background: #fff;
    font-family: 'Bookman Old Style', 'Bookman', Georgia, 'Times New Roman', serif;
    font-size: 12pt;     /* Ukuran 12 */
    color: #000;
    line-height: 1.15;   /* Spasi 1,15 */
  }
  /* Kop dari gambar header.png — TIDAK full kertas: disisakan 10mm di kiri & kanan */
  .kop-img {
    display: block;
    /* lebar kertas Legal 215,9mm dikurangi sisa 10mm kiri + 10mm kanan */
    width: calc(215.9mm - 20mm);
    max-width: none;          /* kalahkan reset Tailwind: img { max-width: 100% } */
    height: auto;
    /* area konten mulai 30mm dari kiri & 20mm dari kanan (padding .print-sheet),
       margin negatif menggeser gambar sampai 10mm dari tepi kertas di kedua sisi */
    margin: 0 -10mm 3mm -20mm;
  }
  /* Footer dari gambar footer.png — melebar penuh & menempel dasar kertas */
  .footer-img {
    position: absolute;
    left: 0; bottom: 0;
    width: 215.9mm;      /* selebar kertas Legal */
    max-width: none;     /* kalahkan reset Tailwind: img { max-width: 100% } */
    height: auto;
  }
  /* Judul & Nomor — Bookman Old Style 12; spasi antara keduanya = 1 (single) */
  .judul {
    text-align: center;
    font-weight: normal !important; /* judul atas (SURAT TUGAS) tidak bold */
    font-family: 'Bookman Old Style', 'Bookman', Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1; /* spasi 1 antara SURAT TUGAS & NOMOR */
    margin: 2mm 0 0;
    text-transform: uppercase;
  }
  .judul-bold { font-weight: bold !important; }
  .nomor {
    text-align: center;
    font-family: 'Bookman Old Style', 'Bookman', Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1; /* spasi 1 */
    margin-bottom: 6mm; /* jeda ke isi di bawah (isi memakai spasi 1.15) */
  }
  .blok { margin-bottom: 3.5mm; }
  .indent { margin-left: 12mm; }
  .par-no { display: flex; gap: 3mm; }
  .par-no .no { min-width: 8mm; }
  .par-no .no.kepada { min-width: 22mm; }
  .par-no .isi { flex: 1; text-align: justify; }
  /* Menimbang & Dasar — dibangun sebagai TABEL tanpa garis (border none):
     kolom label / titik dua / penanda / isi tetap sejajar, tampil seperti surat biasa */
  .kw-table { width: 100%; border-collapse: collapse; margin-bottom: 3.5mm; }
  .kw-table td { border: none; padding: 0.4mm 1.5mm; vertical-align: top; }
  .kw-t-label { width: 28mm; }
  .kw-t-colon { width: 7mm; text-align: center; }
  .kw-t-mark { width: 1%; white-space: nowrap; } /* kolom penanda menyusut → "a." langsung mepet ke isi */
  .kw-t-body { text-align: justify; }
  /* Kepada & Untuk — tabel TANPA garis (border none): kolom tetap sejajar, tampil seperti surat biasa */
  .kepada-table { width: 100%; border-collapse: collapse; margin-bottom: 3.5mm; }
  .kepada-table td { border: none; padding: 1.5mm 1.5mm 0.5mm; vertical-align: top; }
  /* kolom label & titik dua dipersempit supaya kolom isi (nama/NIP) lebih lebar & NIP tidak terpotong */
  .kp-label { width: 22mm; }
  .kp-colon { width: 4mm; text-align: center; }
  .kp-isi { white-space: nowrap; }
  /* Tabel tanda tangan — tabel TERPISAH TANPA GARIS (kolom kiri kosong, ttd di kanan) */
  .ttd-table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
  .ttd-table td { border: none; padding: 0; vertical-align: top; }
  .ttd-kiri { width: 35%; }            /* kolom ttd (kanan) jadi lebih lebar */
  .ttd-blok { text-align: left; }       /* rata kiri */
  /* jarak "Kepala Balai Besar POM Di Palangka Raya," → nama diperbesar (total 40mm, placeholder di tengah) */
  /* Baris variabel ttd_pengirim — DI DALAM kolom tanda tangan, rata kiri indentasi 5 spasi.
     Dibuat "polos" (tanpa kerning/ligatur/letter-spacing).
     CATATAN: jangan menulis tanda dolar + kurung kurawal di komentar CSS ini,
     karena CSS ini adalah template literal JS (akan dianggap interpolasi). */
  .ttd-blok .ttd-pengirim {
    margin-top: 16mm;                  /* jarak judul → kode (ditambah 1 baris lagi) */
    padding-left: 5ch;                 /* indentasi 5 spasi */
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: normal;
    word-spacing: normal;
    text-rendering: geometricPrecision;
  }
  .ttd-blok .nama { margin-top: 20mm; } /* ruang QR ±20mm; nama: tanpa bold & tanpa garis bawah */
  .keterangan-table td { border: 1px solid #000; padding: 1.5mm 2mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; }
  .toolbar button { border: none; border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
  .toolbar-pesan { text-align: center; color: #b91c1c; font-family: system-ui, sans-serif; font-size: 13px; padding: 0 12px 10px; }
  /* ============ LAMPIRAN (landscape) — dipakai bila peserta lebih dari 1 orang ============
     Kertas Legal diputar: 355,6mm × 215,9mm.
     Hanya blok LAMPIRAN / SURAT TUGAS / NOMOR / TANGGAL yang 10pt; judul, tabel,
     dan tanda tangan tetap 12pt. */
  .sheet-landscape {
    page: landscape;         /* ganti orientasi jadi landscape (lihat aturan halaman bernama di @media print) */
    width: 355.6mm;
    min-height: 215.9mm;
    padding: 12mm 18mm 14mm;
  }
  /* Nomor halaman lampiran — di tengah atas.
     margin-bottom: 1.15em = SATU BARIS KOSONG (1x enter) pada ukuran ini:
     font 12pt × line-height 1.15 = 13,8pt ≈ 4,87mm — jarak ke blok LAMPIRAN.
     Diubah 2026-09-11 atas permintaan user (sebelumnya tanpa jarak sama sekali). */
  .lamp-nomor { text-align: center; font-size: 12pt; margin-bottom: 1.15em; }
  /* Dua "kotak" (tanpa garis): KIRI lebih lebar & kosong, KANAN lebih sempit.
     Dipakai DUA kali: blok LAMPIRAN dkk (10pt) dan blok tanda tangan (12pt).
     Isi kotak kanan selalu rata kiri. */
  .lamp-kotak { display: flex; align-items: flex-start; width: 100%; }
  .lamp-kotak-kiri { width: 65%; }
  .lamp-kotak-kanan { width: 35%; text-align: left; }
  /* Blok LAMPIRAN / SURAT TUGAS / NOMOR / TANGGAL — SATU-SATUNYA bagian berukuran 10pt */
  .lamp-kepala { font-size: 10pt; line-height: 1.25; }
  .lamp-judul { text-align: center; font-size: 12pt; font-weight: normal; margin: 8mm 0 0; }
  /* table-layout: fixed → lebar kolom PERSIS seperti yang ditetapkan di bawah.
     Total lebar konten lampiran (Legal landscape) = 355,6mm − 2×18mm padding = 319,6mm. */
  .lamp-table { width: 100%; border-collapse: collapse; margin-top: 5mm; table-layout: fixed; }
  .lamp-table th, .lamp-table td {
    border: 1px solid #000;
    padding: 1.2mm 2mm;
    vertical-align: top;
    font-size: 12pt;
    overflow-wrap: break-word;
  }
  .lamp-table th { text-align: center; font-weight: normal; background: #ececec; }
  .lamp-table .c-no { width: 12mm; text-align: center; }
  .lamp-table .c-nama { width: 96mm; }
  .lamp-table .c-nip { width: 58mm; white-space: nowrap; }
  .lamp-table .c-pangkat { width: 76mm; }
  /* .c-jabatan tidak diberi lebar → otomatis mengisi sisa (± 77,6mm) */
  /* Tanda tangan lampiran — pola 2 kotak juga: kotak kanan lebih sempit, tulisan
     ttd rata kiri. Ukuran tetap 12pt (bukan 10pt). */
  .lamp-ttd { margin-top: 12mm; }
  .lamp-ttd .ttd-pengirim {
    margin-top: 16mm;
    padding-left: 5ch;                 /* indentasi 5 spasi sebelum variabel (sama seperti surat utama) */
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: normal;
    word-spacing: normal;
    text-rendering: geometricPrecision;
  }
  .lamp-ttd .lamp-nama { margin-top: 20mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .print-sheet { margin: 0; width: auto; box-shadow: none; }
    .page-break { page-break-after: always; }
    /* next-route-announcer (elemen bawaan Next.js) duduk setelah lembar terakhir.
       Karena lembar lampiran memakai konteks halaman landscape, kehadiran elemen ini
       memaksa Chrome pindah kembali ke halaman portrait → muncul 1 halaman KOSONG. */
    next-route-announcer { display: none !important; }
    /* Legal: 215.9mm × 355.6mm — margin kertas 0 (margin diatur via padding .print-sheet) */
    @page { size: 215.9mm 355.6mm; margin: 0; }
    /* Halaman bernama "landscape" untuk lampiran (Legal diputar) */
    @page landscape { size: 355.6mm 215.9mm; margin: 0; }
  }
`;

export default function CetakSuratTugas() {
  const router = useRouter();
  const { id } = router.query;
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

  const adaLampiran = (data?.peserta || []).length > 1;

  /* Unduh PDF SATU berkas: surat (portrait) + lampiran (landscape).
     HTML halaman ini dikirim ke backend, lalu dicetak di sana memakai Chrome headless.
     Ini satu-satunya cara menghasilkan PDF dengan orientasi campuran dalam 1 berkas,
     karena dialog print Chrome hanya punya satu pilihan orientasi untuk seluruh dokumen. */
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
      const nama = `Surat-Tugas-${nomor || id}`.replace(/[\\/:*?"<>|]/g, '-');

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
      <Head><title>Cetak | ECIPAR POM</title></Head>
      <style>{CSS}</style>
      <div className="toolbar">
        <button onClick={unduhPdf} disabled={busyPdf} style={{ background: '#18181b', color: '#fde68a', opacity: busyPdf ? 0.6 : 1, cursor: busyPdf ? 'wait' : 'pointer' }}>
          {busyPdf
            ? <><FaSpinner style={{ display: 'inline' }} className="animate-spin" /> Membuat PDF…</>
            : <><FaFilePdf style={{ display: 'inline' }} /> Unduh PDF{adaLampiran ? ' (1 file: surat + lampiran)' : ''}</>}
        </button>
        <button onClick={() => window.close()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Tutup
        </button>
      </div>
      {pesanPdf && <div className="toolbar-pesan">{pesanPdf}</div>}

      <DokumenST data={data} />
      {/* Lebih dari 1 pegawai → halaman lampiran daftar nama (landscape) */}
      {(data.peserta || []).length > 1 && <LampiranPeserta data={data} />}
    </>
  );
}

/* ==================== SURAT TUGAS ==================== */
export function DokumenST({ data }) {
  const menimbang = [['a', data.menimbang_a], ['b', data.menimbang_b]].filter(([, isi]) => isi);
  const dasar = (data.dasar || []).map((d, i) => [String(i + 1), d.isi, d.id ?? i]);

  // Peserta > 1 orang → daftar nama TIDAK ditulis di "Kepada", diganti "Nama-nama terlampir"
  const peserta = data.peserta || [];
  const banyakPeserta = peserta.length > 1;

  const renderSection = (label, rows, keyFn) => (
    <table className="kw-table" key={label}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={keyFn(r, i)}>
            {i === 0 && <td className="kw-t-label" rowSpan={rows.length}>{label}</td>}
            {i === 0 ? <td className="kw-t-colon">:</td> : <td className="kw-t-colon" />}
            <td className="kw-t-mark">{r[0]}.</td>
            <td className="kw-t-body">{r[1]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="print-sheet">
      <img className="kop-img" src="/header.png" alt="Kop surat" />

      <div className="judul">SURAT TUGAS</div>
      <div className="nomor">NOMOR: {data.nomor_st || '.....................................................'}</div>

      {menimbang.length > 0 && renderSection('Menimbang', menimbang, (r) => r[0])}
      {dasar.length > 0 && renderSection('Dasar', dasar, (r) => r[2])}

      <div className="blok">
        <div className="par-no" style={{ justifyContent: 'center' }}>
          <span>Memberi Tugas</span>
        </div>
      </div>

      {/* Kepada & Untuk — tabel bergaris */}
      <table className="kepada-table">
        <tbody>
          <tr>
            <td className="kp-label">Kepada</td>
            <td className="kp-colon">:</td>
            <td>
              {banyakPeserta ? (
                <div>Nama-nama terlampir</div>
              ) : (
                peserta.map((p, i) => (
                  <div key={i} style={{ marginTop: i ? '1.5mm' : 0 }}>
                    {p.nama || '-'}
                    {p.nip ? <>{', '}<span className="kp-isi">{p.nip}</span></> : ''}
                    {p.pangkat ? `, ${p.pangkat}` : ''}
                    {p.jabatan ? `, ${p.jabatan}` : ''}
                  </div>
                ))
              )}
            </td>
          </tr>
          <tr>
            <td className="kp-label">Untuk</td>
            <td className="kp-colon">:</td>
            <td>
              <div className="par-no">
                <span className="no">1.</span>
                <span className="isi">{data.untuk || ''}</span>
              </div>
              <div className="par-no" style={{ marginTop: '1.5mm' }}>
                <span className="no">2.</span>
                <span className="isi">
                  Surat tugas ini berlaku pada Tanggal{' '}
                  {data.rencana_tgl_mulai ? tanggalPanjang(data.rencana_tgl_mulai) : '..............'}{' '}
                  - {data.rencana_tgl_selesai ? tanggalPanjang(data.rencana_tgl_selesai) : '..............'}.
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={3} style={{ textAlign: 'justify' }}>Agar yang bersangkutan melaksanakan tugas dengan baik dan penuh tanggung jawab.</td>
          </tr>
        </tbody>
      </table>

      {/* Tabel tanda tangan — tabel terpisah dari tabel Kepada/Untuk di atas */}
      <table className="ttd-table">
        <tbody>
          <tr>
            <td className="ttd-kiri" />
            <td className="ttd-blok">
              <div>{data.tempat_terbit || 'Palangka Raya'}, {tanggalPanjang(data.tanggal_st)}</div>
              <div>Kepala Balai Besar POM Di Palangka Raya,</div>
              {/* Variabel Srikandi — di dalam kolom ttd, rata kiri, indentasi 5 spasi */}
              <div className="ttd-pengirim">{kodeTtd(data)}</div>
              <div className="nama">{data.nama_kabalai || data.ttd_kepala_nama || TTD_KEPALA_NAMA}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <img className="footer-img" src="/footer.png" alt="Footer" />
    </div>
  );
}

/* ============ LAMPIRAN — halaman daftar nama (landscape), bila peserta > 1 orang ============ */
export function LampiranPeserta({ data }) {
  const peserta = data.peserta || [];
  const tanggal = data.tanggal_st ? tanggalPanjang(data.tanggal_st).toUpperCase() : '';

  return (
    <div className="print-sheet sheet-landscape">
      {/* Nomor halaman — tengah atas */}
      <div className="lamp-nomor">-2-</div>

      {/* Dua kotak: kiri lebar & kosong, kanan lebih sempit — tulisan LAMPIRAN di kotak kanan */}
      <div className="lamp-kotak">
        <div className="lamp-kotak-kiri" aria-hidden="true" />
        <div className="lamp-kotak-kanan lamp-kepala">
          <div>LAMPIRAN</div>
          <div>SURAT TUGAS</div>
          <div>NOMOR&nbsp;&nbsp;&nbsp;: {data.nomor_st || ''}</div>
          <div>TANGGAL&nbsp;: {tanggal}</div>
        </div>
      </div>

      <div className="lamp-judul">DAFTAR NAMA PEGAWAI YANG DIBERI TUGAS</div>

      <table className="lamp-table">
        <thead>
          <tr>
            <th className="c-no">NO</th>
            <th className="c-nama">NAMA</th>
            <th className="c-nip">NIP</th>
            <th className="c-pangkat">PANGKAT/GOLONGAN</th>
            <th>JABATAN</th>
          </tr>
        </thead>
        <tbody>
          {peserta.map((p, i) => (
            <tr key={i}>
              <td className="c-no">{i + 1}</td>
              <td className="c-nama">{p.nama || '-'}</td>
              <td className="c-nip">{formatNip(p.nip) || '-'}</td>
              <td>{p.pangkat || '-'}</td>
              <td>{p.jabatan || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tanda tangan — pola 2 kotak juga: kotak kanan lebih sempit, tulisan rata kiri */}
      <div className="lamp-kotak lamp-ttd">
        <div className="lamp-kotak-kiri" aria-hidden="true" />
        <div className="lamp-kotak-kanan">
          <div>Kepala Balai Besar POM Di Palangka Raya,</div>
          <div className="ttd-pengirim">{kodeTtd(data)}</div>
          <div className="lamp-nama">{data.nama_kabalai || data.ttd_kepala_nama || TTD_KEPALA_NAMA}</div>
        </div>
      </div>
    </div>
  );
}
