// pages/pengaturan/penomoran.js
// Submenu "Penomoran Manual" — nomor SPPD otomatis (urut per tahun).
// Halaman ini KHUSUS admin arsiparis; penjagaan sebenarnya ada di backend
// (routes/penomoran.js → hanyaAdmin). Di UI hanya disembunyikan/ditolak.
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerPenomoran from '../../components/pengaturan/ContainerPenomoran';

export default function PenomoranPage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head><title>Penomoran Manual | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Pengaturan — Penomoran Manual">
        <ContainerPenomoran session={session} status={status} />
      </DashboardLayout>
    </>
  );
}
