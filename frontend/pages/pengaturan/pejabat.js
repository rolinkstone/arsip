// pages/pengaturan/pejabat.js
// Submenu "Pejabat Penandatangan" — mengatur NAMA KEPALA BALAI yang tercetak
// pada Surat Tugas, lampiran, dan SPD/SPPD.
// Halaman ini KHUSUS admin arsiparis; penjagaan sebenarnya ada di backend
// (routes/pejabat.js → hanyaAdmin). Di UI hanya disembunyikan/ditolak.
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerPejabat from '../../components/pengaturan/ContainerPejabat';

export default function PejabatPage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head><title>Pejabat Penandatangan | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Pengaturan — Pejabat Penandatangan">
        <ContainerPejabat session={session} status={status} />
      </DashboardLayout>
    </>
  );
}
