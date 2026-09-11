// pages/surattugas/index.js — SATU halaman untuk seluruh modul Surat Tugas
//   default           -> list (ContainerSuratTugas)
//   ?mode=tambah      -> form buat/edit
//   ?id=123           -> detail
//   ?id=123&cetak=1&jenis=st    -> cetak Surat Tugas (+ lampiran) — standalone
//   ?id=123&cetak=1&jenis=sppd  -> cetak SPD/SPPD — standalone
//   ?id=123&cetak=1&jenis=semua -> SATU berkas: ST + lampiran + semua SPD — standalone
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerSuratTugas from '../../components/surattugas/ContainerSuratTugas';
import CetakSuratTugas from '../../components/surattugas/CetakSuratTugas';
import CetakSPD from '../../components/surattugas/CetakSPD';
import CetakSemua from '../../components/surattugas/CetakSemua';

export default function SuratTugasIndex() {
  const router = useRouter();
  const { cetak, jenis } = router.query;

  // Mode cetak: halaman print berdiri sendiri (tanpa sidebar/layout).
  // Tiap jenis punya file sendiri agar perubahan layout tidak saling menyentuh.
  if (cetak) {
    if (jenis === 'sppd') return <CetakSPD />;
    if (jenis === 'semua') return <CetakSemua />;
    return <CetakSuratTugas />;
  }

  return (
    <>
      <Head><title>Surat Tugas | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Surat Tugas">
        <ContainerSuratTugas />
      </DashboardLayout>
    </>
  );
}

