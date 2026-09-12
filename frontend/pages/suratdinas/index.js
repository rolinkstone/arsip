// pages/suratdinas/index.js
// Menu baru "Surat Dinas" — saat ini hanya judul + keterangan dalam pengembangan.
import Head from 'next/head';
import { FaEnvelopeOpenText } from 'react-icons/fa';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerPengembangan from '../../components/ContainerPengembangan';

export default function SuratDinasIndex() {
  return (
    <>
      <Head><title>Surat Dinas | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Surat Dinas">
        <ContainerPengembangan
          judul="Surat Dinas"
          icon={FaEnvelopeOpenText}
          deskripsi="Modul Surat Dinas masih dalam pengembangan. Fitur ini akan tersedia pada pembaruan berikutnya."
        />
      </DashboardLayout>
    </>
  );
}
