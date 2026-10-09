// components/notadinas/ContainerNotaDinas.js — Container tunggal modul Nota Dinas
// Memilih tampilan berdasarkan query halaman index (/notadinas):
//   default        -> NotaDinasList (daftar)
//   ?mode=tambah   -> FormNotaDinas (buat / edit bila ada &id=)
//   ?id=123        -> DetailNotaDinas
//   (?cetak=1 ditangani langsung di pages/notadinas/index.js -> CetakNotaDinas standalone)
import { useRouter } from 'next/router';
import NotaDinasList from './NotaDinasList';
import FormNotaDinas from './FormNotaDinas';
import DetailNotaDinas from './DetailNotaDinas';

export default function ContainerNotaDinas() {
  const router = useRouter();
  const { id, mode } = router.query;

  if (mode === 'tambah') return <FormNotaDinas />;
  if (id) return <DetailNotaDinas />;
  return <NotaDinasList />;
}
