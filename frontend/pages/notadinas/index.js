// pages/notadinas/index.js
// Menu baru "Nota Dinas" — saat ini hanya judul + keterangan dalam pengembangan.
import Head from 'next/head';
import { FaRegStickyNote } from 'react-icons/fa';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerPengembangan from '../../components/ContainerPengembangan';

export default function NotaDinasIndex() {
  return (
    <>
      <Head><title>Nota Dinas | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Nota Dinas">
        <ContainerPengembangan
          judul="Nota Dinas"
          icon={FaRegStickyNote}
          deskripsi="Modul Nota Dinas masih dalam pengembangan. Fitur ini akan tersedia pada pembaruan berikutnya."
        />
      </DashboardLayout>
    </>
  );
}
