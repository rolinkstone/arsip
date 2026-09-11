// components/surattugas/CetakSemua.js — Cetak/unduh SATU BERKAS PDF:
//   Surat Tugas + lampiran (bila peserta > 1) + SEMUA SPD pegawai.
//
// Isi berkas:
//   1. Surat Tugas (+ lampiran landscape bila peserta > 1 orang)
//   2. SPD per pegawai — HALAMAN DEPAN masing-masing pegawai
//   3. Halaman BELAKANG SPD hanya SEKALI (di SPD terakhir)
//      (2 pegawai → 2 halaman depan + 1 halaman belakang)
//
// CSS diambil dari dua file cetak (CetakSuratTugas.js & CetakSPD.js) supaya
// tampilan tiap lembar tetap sama persis. Karena `.print-sheet` ada di kedua file,
// lembar Surat Tugas dibungkus `.doc-st` lalu ukurannya dikembalikan ke versi ST.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { axiosInstance } from '../../utils/axiosInstance';
import { FaSpinner, FaFilePdf } from 'react-icons/fa';
import { DokumenST, LampiranPeserta, CSS as CSS_ST } from './CetakSuratTugas';
import { DokumenSPD, CSS as CSS_SPD } from './CetakSPD';

const CSS = `
${CSS_ST}
${CSS_SPD}
  /* ===== Khusus berkas gabungan =====
     Lembar Surat Tugas & lampiran dibungkus .doc-st karena aturan .print-sheet milik
     CetakSPD.js (dimuat belakangan) memakai lebar/tinggi/margin/huruf berbeda.
     SEMUA properti yang tertimpa harus dikembalikan, kalau tidak lembar lampiran
     ikut menyempit & setinggi kertas potret (isi landscape jadi terpotong). */
  .doc-st .print-sheet {
    width: 215.9mm;          /* kertas Legal potret */
    min-height: 355.6mm;
    padding: 6mm 20mm 25mm 30mm;
    font-size: 12pt;
  }
  /* LAMPIRAN WAJIB LANDSCAPE: kertas Legal diputar (355,6 × 215,9 mm) */
  .doc-st .print-sheet.sheet-landscape {
    width: 355.6mm;
    min-height: 215.9mm;
    padding: 12mm 18mm 14mm;
  }
  .doc-st .judul { margin: 2mm 0 0; }
  .doc-st .ttd-kiri { width: 35%; }
`;

export default function CetakSemua() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyPdf, setBusyPdf] = useState(false);
  const [pesanPdf, setPesanPdf] = useState('');

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

  const peserta = data?.peserta || [];
  const sppdList = data?.sppd || [];
  const adaSppd = !data?.tanpa_sppd && sppdList.length > 0;

  /* Unduh PDF. HTML halaman ini dikirim ke backend lalu dicetak di sana
     memakai Chrome headless (agar orientasi campuran portrait + landscape benar). */
  const unduhPdf = async () => {
    if (busyPdf) return;
    setBusyPdf(true);
    setPesanPdf('');
    try {
      document.querySelectorAll('img').forEach((img) => { img.src = img.src; });
      const luarHtml = document.documentElement.outerHTML
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<next-route-announcer>[\s\S]*?<\/next-route-announcer>/gi, '');
      const html = `<!doctype html>${luarHtml}`;
      const nomor = String(data?.nomor_st || '').trim();
      const nama = `Surat-Tugas-${nomor || id}${adaSppd ? '-SPD' : ''}`.replace(/[\\/:*?"<>|]/g, '-');

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
      <Head><title>Cetak ST + SPD | ECIPAR POM</title></Head>
      <style>{CSS}</style>
      <div className="toolbar">
        <button onClick={unduhPdf} disabled={busyPdf} style={{ background: '#18181b', color: '#fde68a', opacity: busyPdf ? 0.6 : 1, cursor: busyPdf ? 'wait' : 'pointer' }}>
          {busyPdf
            ? <><FaSpinner style={{ display: 'inline' }} className="animate-spin" /> Membuat PDF…</>
            : <><FaFilePdf style={{ display: 'inline' }} /> Unduh PDF (ST{peserta.length > 1 ? ' + lampiran' : ''}{adaSppd ? ` + ${sppdList.length} SPD` : ''})</>}
        </button>
        <button onClick={() => window.close()} style={{ background: '#e4e4e7', color: '#27272a' }}>
          Tutup
        </button>
      </div>
      {pesanPdf && <div className="toolbar-pesan">{pesanPdf}</div>}

      {/* 1) Surat Tugas + lampiran */}
      <div className="doc-st">
        <DokumenST data={data} />
        {peserta.length > 1 && <LampiranPeserta data={data} />}
      </div>

      {/* 2) SPD: halaman depan tiap pegawai; halaman belakang hanya sekali (SPD terakhir).
           Break diletakkan SESUDAH dokumen — kalau di depan, tiap lembar melahirkan halaman kosong. */}
      {adaSppd && sppdList.map((s, i) => (
        <div key={s.id}>
          <DokumenSPD data={data} sppd={s} halaman2={i === sppdList.length - 1} />
          {i < sppdList.length - 1 && <div className="page-break" />}
        </div>
      ))}
    </>
  );
}
