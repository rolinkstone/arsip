// pages/surattugas/index.js — SATU halaman untuk seluruh modul Surat Tugas
//   default           -> list (ContainerSuratTugas)
//   ?mode=tambah      -> form buat/edit
//   ?id=123           -> detail
//   ?id=123&cetak=1   -> cetak ST/SPPD (standalone, tanpa layout)
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerSuratTugas from '../../components/surattugas/ContainerSuratTugas';
import CetakSuratTugas from '../../components/surattugas/CetakSuratTugas';

export default function SuratTugasIndex() {
  const router = useRouter();
  const { cetak } = router.query;

  // Mode cetak: halaman print berdiri sendiri (tanpa sidebar/layout)
  if (cetak) {
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

