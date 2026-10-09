// pages/notadinas/index.js — SATU halaman untuk seluruh modul Nota Dinas
//   default        -> list (ContainerNotaDinas)
//   ?mode=tambah    -> form buat/edit
//   ?id=123         -> detail
//   ?id=123&cetak=1 -> cetak Nota Dinas (standalone, tanpa sidebar/layout)
import { useRouter } from 'next/router';
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerNotaDinas from '../../components/notadinas/ContainerNotaDinas';
import CetakNotaDinas from '../../components/notadinas/CetakNotaDinas';

export default function NotaDinasIndex() {
  const router = useRouter();
  const { cetak } = router.query;

  // Mode cetak: halaman print berdiri sendiri (format A4).
  if (cetak) return <CetakNotaDinas />;

  return (
    <>
      <Head><title>Nota Dinas | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Nota Dinas">
        <ContainerNotaDinas />
      </DashboardLayout>
    </>
  );
}
