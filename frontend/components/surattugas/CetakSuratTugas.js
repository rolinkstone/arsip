// components/surattugas/CetakSuratTugas.js — Halaman cetak (PDF via browser print)
// ?jenis=st  -> Surat Tugas
// ?jenis=sppd&sppd=<id> -> SPPD tertentu | tanpa sppd -> semua SPPD (page-break tiap lembar)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaPrint, FaSpinner } from 'react-icons/fa';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Pejabat penandatangan ST — dipakai bila field dari server belum tersedia
const TTD_KEPALA_NAMA = 'Ali Yudhi Hartanto, SF., Apt., MM';

function tanggalPanjang(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

const CSS = `
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
  /* Kotak peringatan gratifikasi — kotak tersendiri di bawah kotak tanda tangan */
  .ttd-catatan {
    margin-top: 6mm;
    border: 1px solid #000;
    padding: 2mm 1.5mm;   /* padding kiri/kanan dikecilkan agar teks 12pt tetap 1 baris */
    text-align: center;
    font-size: 12pt;
    line-height: 1.15;
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
  .sppd-table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  .sppd-table td { border: 1px solid #000; padding: 2mm 2.5mm; vertical-align: top; }
  .sppd-table .no { width: 6mm; text-align: center; }
  .sppd-table .sub { width: 6mm; text-align: center; }
  .tb-perjadin { width: 100%; border-collapse: collapse; }
  .tb-perjadin td { border: 1px solid #000; padding: 1.5mm 2mm; font-size: 11pt; }
  .keterangan-table td { border: 1px solid #000; padding: 1.5mm 2mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; }
  .toolbar button { border: none; border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .print-sheet { margin: 0; width: auto; box-shadow: none; }
    .page-break { page-break-after: always; }
    /* Legal: 215.9mm × 355.6mm — margin kertas 0 (margin diatur via padding .print-sheet) */
    @page { size: 215.9mm 355.6mm; margin: 0; }
  }
`;

export default function CetakSuratTugas() {
  const router = useRouter();
  const { id, jenis, sppd } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  const tipe = jenis === 'sppd' ? 'sppd' : 'st';
  const sppdList = data?.sppd?.filter((s) => !sppd || String(s.id) === String(sppd)) || [];

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
        <button onClick={() => window.print()} style={{ background: '#f59e0b', color: '#18181b' }}>
          <FaPrint style={{ display: 'inline' }} /> Cetak / Simpan PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Tutup
        </button>
      </div>

      {tipe === 'st' ? <DokumenST data={data} /> : sppdList.map((s, i) => (
        <div key={s.id}>
          <DokumenSPPD data={data} sppd={s} />
          {i < sppdList.length - 1 && <div className="page-break" />}
        </div>
      ))}
    </>
  );
}

/* ==================== SURAT TUGAS ==================== */
function DokumenST({ data }) {
  const menimbang = [['a', data.menimbang_a], ['b', data.menimbang_b]].filter(([, isi]) => isi);
  const dasar = (data.dasar || []).map((d, i) => [String(i + 1), d.isi, d.id ?? i]);

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
              {(data.peserta || []).map((p, i) => (
                <div key={i} style={{ marginTop: i ? '1.5mm' : 0 }}>
                  {p.nama || '-'}
                  {p.nip ? <>{', '}<span className="kp-isi">{p.nip}</span></> : ''}
                  {p.pangkat ? `, ${p.pangkat}` : ''}
                  {p.jabatan ? `, ${p.jabatan}` : ''}
                </div>
              ))}
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
              <div className="ttd-pengirim">{'${ttd_pengirim}'}</div>
              <div className="nama">{data.ttd_kepala_nama || TTD_KEPALA_NAMA}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Kotak peringatan gratifikasi — di bawah kotak tanda tangan */}
      <div className="ttd-catatan">
        Petugas Tidak Diperkenankan Menerima Gratifikasi Dalam Bentuk Apapun
      </div>

      <img className="footer-img" src="/footer.png" alt="Footer" />
    </div>
  );
}

/* ==================== SPPD (per orang) ==================== */
function DokumenSPPD({ data, sppd }) {
  const instansi = sppd.instansi || 'Balai Besar POM di Palangka Raya';
  return (
    <div className="print-sheet">
      <img className="kop-img" src="/header.png" alt="Kop surat" />

      <div className="judul judul-bold">SURAT PERINTAH PERJALANAN DINAS (SPPD)</div>

      <table className="sppd-table">
        <tbody>
          <tr>
            <td className="no">1.</td>
            <td style={{ width: '45mm' }}>Pejabat Pembuat Komitmen</td>
            <td>: {sppd.ppk_nama || data.ppk_nama || ''}</td>
          </tr>
          <tr>
            <td className="no">2.</td>
            <td>Nama/NIP Pegawai Yang Melaksanakan Perjalanan Dinas</td>
            <td>: {sppd.nama || ''}{sppd.nip ? ` / ${sppd.nip}` : ''}</td>
          </tr>
          <tr>
            <td className="no">3.</td>
            <td>
              a) Pangkat/Golongan<br />
              b) Jabatan/Instansi<br />
              c) Tingkat Biaya Perjalanan Dinas
            </td>
            <td>
              <div>: {sppd.pangkat || ''}</div>
              <div>: {sppd.jabatan || ''} / {instansi}</div>
              <div>: {sppd.tingkat_biaya || ''}</div>
            </td>
          </tr>
          <tr>
            <td className="no">4.</td>
            <td>Maksud Perjalanan Dinas</td>
            <td>: {data.kegiatan || data.untuk || ''}</td>
          </tr>
          <tr>
            <td className="no">5.</td>
            <td>Alat angkut yang dipergunakan</td>
            <td>: {sppd.alat_angkut === 'udara' ? 'Angkutan Udara' : sppd.alat_angkut === 'darat' ? 'Angkutan Darat' : ''}</td>
          </tr>
          <tr>
            <td className="no">6.</td>
            <td>a. Tempat Berangkat<br />b. Tempat Tujuan</td>
            <td>
              <div>: {sppd.tempat_berangkat || ''}</div>
              <div>: {sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</div>
            </td>
          </tr>
          <tr>
            <td className="no">7.</td>
            <td>a. Lama Perjalanan Dinas<br />b. Tanggal Berangkat<br />c. Tanggal harus kembali/tiba di tempat baru *)</td>
            <td>
              <div>: {sppd.lama_perjalanan || ''}</div>
              <div>: {sppd.tanggal_berangkat ? tanggalPanjang(sppd.tanggal_berangkat) : ''}</div>
              <div>: {sppd.tanggal_kembali ? tanggalPanjang(sppd.tanggal_kembali) : ''}</div>
            </td>
          </tr>
          <tr>
            <td className="no">8.</td>
            <td>Pengikut</td>
            <td>
              <table className="tb-perjadin">
                <thead>
                  <tr>
                    <td className="center" style={{ width: '8mm' }}>No</td>
                    <td className="center">Nama</td>
                    <td className="center" style={{ width: '30mm' }}>Tanggal Lahir</td>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <tr key={n} style={{ height: '7mm' }}>
                      <td className="center">{n}.</td>
                      <td />
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="no">9.</td>
            <td>Pembebanan Anggaran<br />a. Instansi<br />b. Mata Anggaran</td>
            <td>
              <div>: {instansi}</div>
              <div>: {sppd.mata_anggaran || data.mak || ''}</div>
            </td>
          </tr>
          <tr>
            <td className="no">10.</td>
            <td>Keterangan Lain-lain</td>
            <td>: {sppd.keterangan_lain || ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="blok" style={{ marginTop: '6mm' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '40mm' }}>Dikeluarkan di</td>
              <td style={{ width: '10mm' }}>:</td>
              <td>{data.tempat_terbit || 'Palangka Raya'}</td>
              <td rowSpan="2" style={{ width: '75mm', textAlign: 'center', verticalAlign: 'top' }}>
                <div>Pembuat Komitmen,</div>
                <div style={{ marginTop: '26mm' }} className="nama">
                  {(sppd.ppk_nama || data.ppk_nama || '').split(' / ')[0]}
                </div>
                {sppd.ppk_nip || data.ppk_nip ? <div>NIP. {(sppd.ppk_nip || data.ppk_nip).split(' / ')[0]}</div> : null}
              </td>
            </tr>
            <tr>
              <td>Pada Tanggal</td>
              <td>:</td>
              <td>{data.tanggal_st ? tanggalPanjang(data.tanggal_st) : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Kotak peringatan gratifikasi — di bawah kotak tanda tangan */}
      <div className="ttd-catatan">
        Petugas Tidak Diperkenankan Menerima Gratifikasi Dalam Bentuk Apapun
      </div>

      <div className="blok" style={{ marginTop: '4mm', fontSize: '11pt' }}>
        <table className="tb-perjadin">
          <tbody>
            <tr>
              <td style={{ width: '16mm' }}>Berangkat dari</td>
              <td style={{ width: '45mm' }}>: {sppd.tempat_berangkat || ''} (Tempat Kedudukan)</td>
              <td style={{ width: '14mm' }}>Pada Tanggal</td>
              <td>: {sppd.tanggal_berangkat ? tanggalPanjang(sppd.tanggal_berangkat) : ''}</td>
              <td>Ke {sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</td>
            </tr>
            <tr>
              <td>Tiba di</td>
              <td>: {sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</td>
              <td>Pada Tanggal</td>
              <td>: {sppd.tanggal_kembali ? tanggalPanjang(sppd.tanggal_kembali) : ''}</td>
              <td />
            </tr>
            <tr>
              <td>Berangkat dari</td>
              <td>: {sppd.tempat_tujuan || data.kota_kab_kecamatan || ''}</td>
              <td>Pada Tanggal</td>
              <td>: {sppd.tanggal_kembali ? tanggalPanjang(sppd.tanggal_kembali) : ''}</td>
              <td>Ke {sppd.tempat_berangkat || ''}</td>
            </tr>
            <tr>
              <td>Tiba di</td>
              <td>: {sppd.tempat_berangkat || ''}</td>
              <td>Pada Tanggal</td>
              <td />
              <td />
            </tr>
            <tr>
              <td>Tiba Kembali</td>
              <td>: {sppd.tempat_berangkat || ''}</td>
              <td>Pada Tanggal</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '9.5pt', marginTop: '5mm', textAlign: 'justify' }}>
        <b>PERHATIAN:</b> Pejabat yang berwenang memberikan SPPD, pegawai yang melakukan perjalanan dinas,
        para pejabat yang mensahkan tanggal berangkat/tiba, serta bendaharawan bertanggung jawab berdasarkan
        peraturan-peraturan Keuangan Negara, apabila negara menerima rugi akibat kesalahan, kelalaian dan kealpaan.
      </div>

      <img className="footer-img" src="/footer.png" alt="Footer" />
    </div>
  );
}
