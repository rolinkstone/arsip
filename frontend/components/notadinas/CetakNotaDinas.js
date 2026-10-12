// components/notadinas/CetakNotaDinas.js — Halaman cetak NOTA DINAS
//
// Format (sesuai template resmi):
//   - Kertas A4 (210 × 297 mm), orientasi portrait
//   - Font Arial 12 pt, spasi baris 1,15
//   - Batas tepi: kiri 3 cm, kanan 2 cm (atas/bawah 2 cm)
//   - Kop TEKS (tanpa gambar header): "BADAN PENGAWAS OBAT DAN MAKANAN" +
//     "BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA"
//   - Judul "NOTA DINAS" + "NOMOR : …" di tengah
//   - Blok Yth / Dari / Lampiran / Hal / Tanggal, garis pemisah, isi paragraf
//   - Blok tanda tangan (placeholder Srikandi + nama penandatangan)
//   - HALAMAN LAMPIRAN (bila kolom "isi lampiran" diisi): lembar tersendiri di
//     belakang surat dengan kepala di kanan atas — "Lampiran / Nota Dinas … /
//     Di <tempat> / Nomor / Tanggal" — lalu isi lampiran + blok tanda tangan.
//   - Nomor halaman: HANYA pada halaman ke-2 dst. (halaman pertama tanpa
//     nomor), di TENGAH ATAS dengan format "-N-" (mis. -2-) — sama seperti
//     nomor halaman lampiran Surat Tugas (.lamp-nomor). Penomoran menerus
//     dari halaman surat ke halaman lampiran.
//
// CATATAN PAGINASI: isi nota dinas dipecah menjadi beberapa halaman A4 di sisi
// klien. Tinggi tiap blok DIUKUR pada lebar konten yang sama (160 mm) memakai
// elemen bayangan (lihat .ukur), lalu blok diisi ke tiap halaman secara
// berurutan sehingga NOMOR HALAMAN benar-benar sesuai jumlah lembar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaSpinner, FaFilePdf } from 'react-icons/fa';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function tanggalPanjang(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Teks → daftar paragraf (satu baris = satu paragraf, baris kosong diabaikan). */
function keParagraf(teks) {
  return String(teks || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------- ukuran halaman (mm) ----------
const LEBAR_MM = 210;
const TINGGI_MM = 297;
const TEPI = { atas: 20, bawah: 20, kiri: 30, kanan: 20 }; // kiri 3 cm, kanan 2 cm
const LEBAR_KONTEN_MM = LEBAR_MM - TEPI.kiri - TEPI.kanan;   // 160 mm
const TINGGI_KONTEN_MM = TINGGI_MM - TEPI.atas - TEPI.bawah; // 257 mm

export const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7e5e4; }
  .sheet {
    position: relative;
    width: ${LEBAR_MM}mm;
    height: ${TINGGI_MM}mm;
    margin: 10mm auto;
    padding: ${TEPI.atas}mm ${TEPI.kanan}mm ${TEPI.bawah}mm ${TEPI.kiri}mm;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12pt;      /* Ukuran 12 */
    line-height: 1.15;    /* Spasi 1,15 */
    color: #000;
    overflow: hidden;     /* tiap lembar = tepat satu halaman A4 */
  }
  .sheet + .sheet { page-break-before: always; }

  /* ---------- kop: TEKS saja (tanpa gambar header) ---------- */
  .kop-teks { text-align: center; margin-bottom: 4mm; }
  .kop-teks div { line-height: 1.15; }
  /* Blok kop+judul+nomor+field dibungkus BFC (flow-root) supaya margin anak
     terakhir (garis pemisah) tetap ikut terhitung saat paginasi mengukur. */
  .kepala-dokumen { display: flow-root; }

  /* ---------- judul & nomor (tengah) ---------- */
  .judul { text-align: center; line-height: 1; margin: 2mm 0 0; }
  .nomor { text-align: center; line-height: 1; margin-bottom: 6mm; }

  /* ---------- blok Yth / Dari / Lampiran / Hal / Tanggal ---------- */
  .field-table { width: 100%; border-collapse: collapse; }
  .field-table td { border: none; padding: 0 0 0.6mm; vertical-align: top; }
  .f-label { width: 22mm; }
  .f-colon { width: 4mm; }
  .f-value { white-space: pre-line; }   /* hormati baris baru (mis. "… \\n Di Palangka Raya") */

  /* garis pemisah di bawah blok field */
  .garis { border: none; border-top: 1px solid #000; margin: 3.5mm 0 5mm; }

  /* ---------- isi ---------- */
  .par { margin: 0 0 1.15em; text-align: justify; }  /* satu baris kosong antar paragraf */

  /* ---------- tanda tangan (posisi & indentasi SAMA dengan Surat Tugas) ---------- */
  /* Blok tanda tangan mulai 35% + indentasi 5 spasi (seluruh blok digeser ke kanan),
     supaya nama penandatangan lebih ke kanan; baris variabel ttd_pengirim tetap
     menjorok 5 spasi dari nama seperti pada Surat Tugas.
     CATATAN: jangan menulis tanda dolar + kurung kurawal di komentar CSS ini
     (CSS ini template literal JS → dianggap interpolasi). */
  .ttd { margin-top: 8mm; margin-left: 35%; padding-left: 5ch; text-align: left; }
  .ttd-jabatan { margin-bottom: 1.15em; }
  /* Baris variabel ttd_pengirim — menjorok 5 spasi dari nama, "polos"
     (tanpa kerning/ligatur/letter-spacing). */
  .ttd-kode {
    padding-left: 5ch;
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: normal;
    word-spacing: normal;
    text-rendering: geometricPrecision;
  }
  .ttd-nama { margin-top: 20mm; }

  /* ---------- kepala halaman LAMPIRAN (kanan atas) ---------- */
  .lamp-kepala { display: flow-root; margin-left: 38%; margin-bottom: 6mm; }
  .lamp-field { border-collapse: collapse; }
  .lamp-field td { border: none; padding: 0; vertical-align: top; }
  .lamp-field .lf-label { width: 18mm; }
  .lamp-field .lf-colon { width: 4mm; }

  /* ---------- nomor halaman (-N-) — tengah ATAS, hanya halaman ke-2 dst.
     Format & posisi sama dengan nomor halaman lampiran Surat Tugas (.lamp-nomor). ---------- */
  .nomor-halaman { text-align: center; font-size: 12pt; margin-bottom: 1.15em; }

  /* ---------- alat ukur tersembunyi (untuk paginasi) ---------- */
  .ukur {
    position: absolute;
    left: -10000px;
    top: 0;
    width: ${LEBAR_KONTEN_MM}mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12pt;
    line-height: 1.15;
    color: #000;
    visibility: hidden;
    pointer-events: none;
  }

  /* ---------- toolbar layar (tidak ikut tercetak) ---------- */
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; }
  .toolbar button { border: none; border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; font-family: system-ui, sans-serif; }
  .toolbar-pesan { text-align: center; color: #b91c1c; font-family: system-ui, sans-serif; font-size: 13px; padding: 0 12px 10px; }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .toolbar-pesan { display: none !important; }
    .ukur { display: none !important; }
    .sheet { margin: 0; box-shadow: none; }
    /* A4 portrait; margin kertas 0 karena margin diatur via padding .sheet */
    @page { size: ${LEBAR_MM}mm ${TINGGI_MM}mm; margin: 0; }
    /* next-route-announcer (bawaan Next.js) bisa memunculkan halaman kosong */
    next-route-announcer { display: none !important; }
  }
`;

// ---------- kop (teks) + judul + nomor + field ----------
function KepalaDokumen({ data }) {
  return (
    <div className="kepala-dokumen" data-header="surat">
      <div className="kop-teks">
        <div>BADAN PENGAWAS OBAT DAN MAKANAN</div>
        <div>BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PALANGKA RAYA</div>
      </div>
      <div className="judul">NOTA DINAS</div>
      <div className="nomor">NOMOR : {data.nomor_nd || '…'}</div>
      <table className="field-table">
        <tbody>
          <tr>
            <td className="f-label">Yth</td>
            <td className="f-colon">:</td>
            <td className="f-value">{data.kepada || ''}</td>
          </tr>
          <tr>
            <td className="f-label">Dari</td>
            <td className="f-colon">:</td>
            <td className="f-value">{data.dari || ''}</td>
          </tr>
          <tr>
            <td className="f-label">Lampiran</td>
            <td className="f-colon">:</td>
            <td className="f-value">{data.lampiran || '-'}</td>
          </tr>
          <tr>
            <td className="f-label">Hal</td>
            <td className="f-colon">:</td>
            <td className="f-value">{data.hal || ''}</td>
          </tr>
          <tr>
            <td className="f-label">Tanggal</td>
            <td className="f-colon">:</td>
            <td className="f-value">{tanggalPanjang(data.tanggal_nd)}</td>
          </tr>
        </tbody>
      </table>
      <hr className="garis" />
    </div>
  );
}

// ---------- kepala halaman LAMPIRAN (kanan atas) ----------
function KepalaLampiran({ data }) {
  // Jabatan pada baris "Nota Dinas …": pakai jabatan penandatangan bila diisi,
  // kalau tidak memakai teks baku template.
  const jabatan = (data.penandatangan_jabatan || '').trim() || 'Kepala Balai Besar POM';
  return (
    <div className="lamp-kepala" data-header="lampiran">
      <div>Lampiran</div>
      <div>Nota Dinas {jabatan}</div>
      <div>Di {data.tempat_terbit || 'Palangka Raya'}</div>
      <table className="lamp-field">
        <tbody>
          <tr>
            <td className="lf-label">Nomor</td>
            <td className="lf-colon">:</td>
            <td>{data.nomor_nd || ''}</td>
          </tr>
          <tr>
            <td className="lf-label">Tanggal</td>
            <td className="lf-colon">:</td>
            <td>{tanggalPanjang(data.tanggal_nd)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------- blok tanda tangan ----------
function TandaTangan({ data, grup }) {
  const nama = data.penandatangan_nama || data.ttd_kepala_nama || '';
  return (
    <div className="ttd" data-block={grup}>
      {data.penandatangan_jabatan ? (
        <div className="ttd-jabatan">{data.penandatangan_jabatan}</div>
      ) : null}
      {/* Kode variabel tanda tangan Srikandi — ditulis sebagai string berkutip
          tunggal supaya TIDAK dianggap interpolasi JS/CSS. */}
      <div className="ttd-kode">{'${ttd_pengirim}'}</div>
      {nama ? <div className="ttd-nama">{nama}</div> : null}
    </div>
  );
}

// ---------- satu blok isi (paragraf ke-i, atau tanda tangan di akhir) ----------
// `grup` = 'surat' atau 'lampiran' — penanda bagian, dipakai saat paginasi.
function Blok({ paragraf, bi, data, grup }) {
  if (bi < paragraf.length) {
    return <p className="par" data-block={grup}>{paragraf[bi]}</p>;
  }
  return <TandaTangan data={data} grup={grup} />;
}

/** Tinggi elemen TERMASUK margin atas/bawah — dipakai untuk paginasi. */
function tinggiDenganMargin(el) {
  const r = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return r.height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
}

/** Bagi daftar tinggi blok ke halaman. Kapasitas halaman pertama beda karena
 *  memuat kepala (kop+judul+field, atau kepala lampiran) yang berbeda tinggi. */
function bagiHalaman(tinggiBlok, kapasitasPertama, kapasitasLanjutan) {
  const halaman = [];
  let sekarang = [];
  let sisa = kapasitasPertama;

  tinggiBlok.forEach((h, i) => {
    // Pindah halaman bila blok tidak muat. Halaman kosong tidak akan terjadi
    // karena blok yang lebih tinggi dari kapasitas tetap dimasukkan.
    if (sekarang.length && h > sisa) {
      halaman.push(sekarang);
      sekarang = [];
      sisa = kapasitasLanjutan;
    }
    sekarang.push(i);
    sisa -= h;
  });
  if (sekarang.length || halaman.length === 0) halaman.push(sekarang);

  return halaman;
}

/**
 * Bagi isi menjadi halaman A4 untuk DUA bagian:
 *   - `surat`    : kop + judul + blok field, lalu isi + tanda tangan
 *   - `lampiran` : kepala lampiran (kanan atas), lalu isi lampiran + tanda tangan
 * Hasil tiap bagian = array halaman, dan tiap halaman = array indeks blok.
 * Blok diukur pada elemen `.ukur` (lebar konten & font sama dengan cetakan).
 * Halaman pertama tiap bagian lebih sempit (memuat kepala); halaman ke-2 dst.
 * lebih sempit karena memuat nomor halaman di atas.
 */
function hitungHalaman(root) {
  const probe = root.querySelector('[data-probe-mm]');
  // 100 mm bila probe ada; kalau tidak, pakai rasio CSS standar (96 dpi).
  const pxPerMm = probe ? probe.getBoundingClientRect().height / 100 : 96 / 25.4;

  const tinggi = (sel) => {
    const el = root.querySelector(sel);
    return el ? tinggiDenganMargin(el) : 0;
  };
  const tinggiBlok = (grup) =>
    Array.from(root.querySelectorAll(`[data-block="${grup}"]`)).map(tinggiDenganMargin);

  const kapasitasPenuh = TINGGI_KONTEN_MM * pxPerMm;
  // Nomor halaman hanya muncul di halaman ke-2 dst. → kurangi kapasitas
  // halaman lanjutan, bukan halaman pertama.
  const kapasitasLanjutan = kapasitasPenuh - tinggi('[data-nomor]');

  const surat = bagiHalaman(
    tinggiBlok('surat'),
    kapasitasPenuh - tinggi('[data-header="surat"]'),
    kapasitasLanjutan
  );

  const blokLampiran = tinggiBlok('lampiran');
  const lampiran = blokLampiran.length
    ? bagiHalaman(blokLampiran, kapasitasPenuh - tinggi('[data-header="lampiran"]'), kapasitasLanjutan)
    : [];

  return { surat, lampiran };
}

export default function CetakNotaDinas() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [halaman, setHalaman] = useState(null); // null = belum dihitung → render 1 halaman
  const [busyPdf, setBusyPdf] = useState(false);
  const [pesanPdf, setPesanPdf] = useState('');
  const ukurRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await axiosInstance.get(`/notadinas/${id}`);
        setData(res.data?.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Isi & lampiran dipecah per baris → tiap baris = satu paragraf.
  const paragraf = useMemo(() => keParagraf(data?.isi), [data]);
  const paragrafLampiran = useMemo(() => keParagraf(data?.lampiran_isi), [data]);
  const adaLampiran = paragrafLampiran.length > 0;

  // Hitung paginasi setelah data tampil. Ukuran diambil dari elemen `.ukur`
  // yang selalu dirender (tersembunyi) sehingga blok pada halaman cetak persis
  // sama ukurannya.
  useEffect(() => {
    if (!data || !ukurRef.current) return undefined;
    const raf = requestAnimationFrame(() => {
      try {
        setHalaman(hitungHalaman(ukurRef.current));
      } catch (e) {
        // Pengukuran gagal (mis. lingkungan tanpa layout) → satu halaman saja.
        console.warn('Gagal menghitung paginasi nota dinas:', e);
        setHalaman(null);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [data, paragraf, paragrafLampiran]);

  const unduhPdf = async () => {
    if (busyPdf) return;
    setBusyPdf(true);
    setPesanPdf('');
    try {
      const luarHtml = document.documentElement.outerHTML
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<next-route-announcer>[\s\S]*?<\/next-route-announcer>/gi, '');
      const html = `<!doctype html>${luarHtml}`;
      const nomor = String(data?.nomor_nd || '').trim();
      const nama = `Nota-Dinas-${nomor || id}`.replace(/[\\/:*?"<>|]/g, '-');

      const res = await axiosInstance.post('/notadinas/pdf', { html, namaFile: nama }, { responseType: 'blob' });
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

  // Daftar halaman cetak: halaman SURAT dulu, lalu halaman LAMPIRAN.
  // Blok = semua paragraf + indeks tanda tangan (bi === paragraf.length).
  // Bila pengukuran belum selesai, tiap bagian diletakkan pada satu halaman.
  const halamanSemua = halaman?.surat?.length
    ? [
        ...halaman.surat.map((indeks, i) => ({
          indeks, blok: paragraf, grup: 'surat', kepalaSurat: i === 0, kepalaLampiran: false,
        })),
        ...halaman.lampiran.map((indeks, i) => ({
          indeks, blok: paragrafLampiran, grup: 'lampiran', kepalaSurat: false, kepalaLampiran: i === 0,
        })),
      ]
    : [
        {
          indeks: paragraf.map((_, i) => i).concat(paragraf.length),
          blok: paragraf, grup: 'surat', kepalaSurat: true, kepalaLampiran: false,
        },
        ...(adaLampiran
          ? [{
              indeks: paragrafLampiran.map((_, i) => i).concat(paragrafLampiran.length),
              blok: paragrafLampiran, grup: 'lampiran', kepalaSurat: false, kepalaLampiran: true,
            }]
          : []),
      ];

  return (
    <>
      <Head><title>Cetak Nota Dinas | ECIPAR POM</title></Head>
      <style>{CSS}</style>
      <div className="toolbar">
        <button
          onClick={unduhPdf}
          disabled={busyPdf}
          style={{ background: '#18181b', color: '#fde68a', opacity: busyPdf ? 0.6 : 1, cursor: busyPdf ? 'wait' : 'pointer' }}
        >
          {busyPdf
            ? <><FaSpinner style={{ display: 'inline' }} className="animate-spin" /> Membuat PDF…</>
            : <><FaFilePdf style={{ display: 'inline' }} /> Unduh PDF</>}
        </button>
        <button onClick={() => window.print()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Cetak
        </button>
        <button onClick={() => window.close()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Tutup
        </button>
      </div>
      {pesanPdf && <div className="toolbar-pesan">{pesanPdf}</div>}

      {/* Elemen bayangan untuk MENGUKUR tinggi blok (lebar & font sama). */}
      <div className="ukur" ref={ukurRef} aria-hidden="true">
        <div data-probe-mm style={{ height: '100mm', position: 'absolute', visibility: 'hidden', width: '1px' }} />
        {/* Contoh nomor halaman — hanya dipakai untuk mengukur tingginya. */}
        <div className="nomor-halaman" data-nomor>-2-</div>

        {/* Bagian 1 — badan surat */}
        <KepalaDokumen data={data} />
        {paragraf.map((_, i) => <Blok key={`s-${i}`} paragraf={paragraf} bi={i} data={data} grup="surat" />)}
        <TandaTangan data={data} grup="surat" />

        {/* Bagian 2 — halaman lampiran (bila isinya diisi) */}
        {adaLampiran && (
          <>
            <KepalaLampiran data={data} />
            {paragrafLampiran.map((_, i) => (
              <Blok key={`l-${i}`} paragraf={paragrafLampiran} bi={i} data={data} grup="lampiran" />
            ))}
            <TandaTangan data={data} grup="lampiran" />
          </>
        )}
      </div>

      {halamanSemua.map((h, gi) => (
        <div className="sheet" key={gi}>
          {/* Halaman PERTAMA tidak bernomor; halaman ke-2 dst. bernomor di
              tengah atas dengan format "-N-" (sama seperti lampiran Surat Tugas).
              Penomoran menerus dari halaman surat ke halaman lampiran. */}
          {gi > 0 && <div className="nomor-halaman">{`-${gi + 1}-`}</div>}
          {h.kepalaSurat && <KepalaDokumen data={data} />}
          {h.kepalaLampiran && <KepalaLampiran data={data} />}
          {h.indeks.map((bi) => (
            <Blok key={bi} paragraf={h.blok} bi={bi} data={data} grup={h.grup} />
          ))}
        </div>
      ))}
    </>
  );
}
