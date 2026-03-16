import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description:
    'Pelajari bagaimana Gudang WA melindungi data Anda dan aturan penggunaan nomor WhatsApp untuk komisi.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className='min-h-screen py-20 px-4'>
      <div className='max-w-4xl mx-auto p-4 mt-6'>
        <Link
          href='/'
          className='text-[#33BB5D] hover:underline mb-8 inline-block font-medium'
        >
          ← Kembali ke Beranda
        </Link>

        <h1 className='text-3xl md:text-4xl font-bold text-[#0E4643] mb-8'>
          Kebijakan Privasi
        </h1>

        <div className='prose prose-slate max-w-none text-[#0A2E1E] space-y-6'>
          <section>
            <h2 className='text-xl font-semibold text-[#14603e]'>
              1. Pendahuluan
            </h2>
            <p>
              Selamat datang di Gudang WA. Kami menghargai privasi Anda dan
              berkomitmen untuk melindungi data pribadi Anda. Kebijakan Privasi
              ini menjelaskan bagaimana kami mengelola informasi Anda saat
              menggunakan platform kami.
            </p>
          </section>

          <section className='bg-[#33BB5D]/5 p-6 rounded-xl border border-[#33BB5D]/20'>
            <h2 className='text-xl font-semibold text-[#14603e]'>
              2. Penggunaan Nomor WhatsApp (Pairing)
            </h2>
            <p className='mt-2'>
              Dengan menghubungkan atau melakukan <strong>pairing</strong> nomor
              WhatsApp Anda ke platform Gudang WA, Anda memberikan hak kepada
              Gudang WA untuk:
            </p>
            <ul className='list-disc ml-6 mt-2 space-y-2'>
              <li>
                Menggunakan nomor tersebut sebagai jalur pengiriman pesan
                (gateway) dalam sistem kami.
              </li>
              <li>
                Mengelola sesi pengiriman pesan secara otomatis melalui
                infrastruktur teknologi kami.
              </li>
            </ul>
          </section>

          <section className='bg-[#E6F56A]/10 p-6 rounded-xl border border-[#E6F56A]/30'>
            <h2 className='text-xl font-semibold text-[#14603e]'>
              3. Hak Komisi Pengguna
            </h2>
            <p className='mt-2'>
              Sebagai imbalan atas penggunaan nomor WhatsApp yang telah berhasil
              dipasangkan (paired), pengguna berhak mendapatkan poin-poin
              berikut:
            </p>
            <ul className='list-disc ml-6 mt-2 space-y-2'>
              <li>
                <strong>Komisi Per Pesan:</strong> Pengguna akan menerima komisi
                untuk setiap unit pesan yang berhasil terkirim melalui nomor
                mereka.
              </li>
              <li>
                <strong>Transparansi Saldo:</strong> Seluruh komisi yang didapat
                akan dicatat secara otomatis dan dapat dipantau melalui
                dashboard profil pengguna.
              </li>
              <li>
                <strong>Penarikan Dana:</strong> Komisi yang terkumpul dapat
                ditarik sesuai dengan ketentuan ambang batas penarikan yang
                berlaku di platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold text-[#14603e]'>
              4. Keamanan Data
            </h2>
            <p>
              Kami menggunakan enkripsi standar industri untuk memastikan bahwa
              komunikasi dan data di dalam platform kami tetap aman. Kami tidak
              menyimpan konten pesan pribadi Anda di luar kebutuhan teknis
              pengiriman.
            </p>
          </section>

          <section>
            <h2 className='text-xl font-semibold text-[#14603e]'>
              5. Perubahan Kebijakan
            </h2>
            <p>
              Gudang WA berhak untuk memperbarui Kebijakan Privasi ini
              sewaktu-waktu. Perubahan akan diinformasikan melalui platform atau
              email terdaftar.
            </p>
          </section>

          <div className='pt-8 border-t border-slate-100 text-sm text-slate-500'>
            Terakhir diperbarui:{' '}
            {new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
