// components/surattugas/ContainerSuratTugas.js — Container tunggal modul Surat Tugas
// Memilih tampilan berdasarkan query halaman index (/surattugas):
//   default        -> SuratTugasList (daftar)
//   ?mode=tambah   -> FormSuratTugas (buat / edit bila ada &id=)
//   ?id=123        -> DetailSuratTugas
//   (?cetak=1 ditangani langsung di pages/surattugas/index.js -> CetakSuratTugas standalone)
import { useRouter } from 'next/router';
import SuratTugasList from './SuratTugasList';
import FormSuratTugas from './FormSuratTugas';
import DetailSuratTugas from './DetailSuratTugas';

export default function ContainerSuratTugas() {
  const router = useRouter();
  const { id, mode } = router.query;

  if (mode === 'tambah') {
    return <FormSuratTugas />;
  }
  if (id) {
    return <DetailSuratTugas />;
  }
  return <SuratTugasList />;
}
