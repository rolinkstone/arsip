// pages/pengaturan/index.js
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import ContainerPengaturan from '../../components/pengaturan/ContainerPengaturan';

export default function PengaturanPage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head><title>Dasar Aturan | ECIPAR POM</title></Head>
      <DashboardLayout pageTitle="Pengaturan — Dasar Aturan">
        <ContainerPengaturan session={session} status={status} />
      </DashboardLayout>
    </>
  );
}
