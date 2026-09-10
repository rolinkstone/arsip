// pages/index.js — Halaman tipis Beranda (logic di components/beranda/ContainerBeranda.js)
import Head from 'next/head';
import DashboardLayout from '../components/DashboardLayout';
import ContainerBeranda from '../components/beranda/ContainerBeranda';

export default function Home() {
  return (
    <>
      <Head>
        <title>Beranda | ECIPAR POM</title>
      </Head>
      <DashboardLayout pageTitle="Beranda">
        <ContainerBeranda />
      </DashboardLayout>
    </>
  );
}
