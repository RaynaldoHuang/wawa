import Link from 'next/link';
import {
  BookOpen,
  Smartphone,
  ShieldCheck,
  Wallet,
  HelpCircle,
  MessageSquare,
} from 'lucide-react';

const steps = [
  {
    icon: <Smartphone className='w-6 h-6 text-[#33BB5D]' />,
    title: '1. Daftarkan Akun',
    description:
      'Buka halaman registrasi dan buat akun Gudang WA Anda secara gratis.',
  },
  {
    icon: <MessageSquare className='w-6 h-6 text-[#33BB5D]' />,
    title: '2. Hubungkan WhatsApp',
    description:
      'Gunakan fitur Scan QR untuk melakukan pairing nomor WhatsApp Anda ke platform kami.',
  },
  {
    icon: <ShieldCheck className='w-6 h-6 text-[#33BB5D]' />,
    title: '3. Status Aktif',
    description:
      'Setelah berhasil terhubung, pastikan status perangkat Anda adalah "Connected" agar siap menerima pesan.',
  },
  {
    icon: <Wallet className='w-6 h-6 text-[#33BB5D]' />,
    title: '4. Dapatkan Komisi',
    description:
      'Setiap pesan yang berhasil terkirim dari nomor Anda memberikan komisi otomatis yang masuk ke saldo akun Anda.',
  },
];

const faqs = [
  {
    question: 'Bagaimana sistem penggunaan nomor saya?',
    answer:
      'Sesuai Kebijakan Privasi, dengan melakukan pairing, Anda memberikan hak kepada Gudang WA untuk menggunakan nomor tersebut sebagai jalur pengiriman pesan (gateway) otomatis pada sistem kami.',
  },
  {
    question: 'Berapa komisi yang saya dapatkan?',
    answer:
      'Anda berhak mendapatkan komisi untuk setiap unit pesan yang berhasil terkirim melalui nomor Anda. Detail komisi dan akumulasi saldo dapat Anda pantau secara langsung di dashboard.',
  },
  {
    question: 'Apakah nomor saya aman?',
    answer:
      'Ya, kami menggunakan sistem yang dirancang untuk menjaga keamanan sesi WhatsApp Anda. Namun, pastikan nomor Anda memiliki riwayat chat yang sehat untuk menghindari pembatasan dari pihak WhatsApp.',
  },
  {
    question: 'Kapan komisi bisa ditarik?',
    answer:
      'Penarikan dana dapat dilakukan setiap kali saldo Anda mencapai ambang batas minimum penarikan yang telah ditentukan di dashboard.',
  },
  {
    question: 'Bisakah saya menggunakan nomor ini untuk chat biasa?',
    answer:
      'Tentu. Anda tetap dapat menggunakan WhatsApp Anda secara normal di smartphone seperti biasa meskipun sedang terhubung ke platform kami.',
  },
];

export default function GuidePage() {
  return (
    <div className='min-h-screen py-20 px-4'>
      <div className='max-w-4xl mx-auto p-4 mt-6'>
        <Link
          href='/'
          className='text-[#33BB5D] hover:underline mb-8 inline-block font-medium'
        >
          ← Kembali ke Beranda
        </Link>

        <div>
          <div className='flex items-center gap-3 mb-6'>
            <BookOpen className='size-6 xl:size-8 text-[#33BB5D]' />
            <h1 className='text-2xl md:text-4xl font-bold text-[#0E4643]'>
              Panduan Pengguna
            </h1>
          </div>

          <p className='text-[#0A2E1E] mb-10'>
            Ikuti langkah-langkah mudah di bawah ini untuk mulai menghasilkan
            cuan melalui nomor WhatsApp Anda.
          </p>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-12'>
            {steps.map((step, index) => (
              <div
                key={index}
                className='p-6 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-[#33BB5D]/30 transition-colors'
              >
                <div className='mb-4'>{step.icon}</div>
                <h3 className='text-xl font-semibold text-[#14603e] mb-2'>
                  {step.title}
                </h3>
                <p className='text-[#0A2E1E] leading-relaxed'>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='bg-[#0E4643] p-8 md:p-12 rounded-2xl shadow-sm text-white border border-[#0E4643]'>
          <div className='flex items-center gap-3 mb-8'>
            <HelpCircle className='w-8 h-8 text-[#E6F56A]' />
            <h2 className='text-2xl font-bold'>
              Pertanyaan Sering Diajukan (FAQ)
            </h2>
          </div>

          <div className='space-y-6'>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className='border-b border-white/10 pb-6 last:border-0 last:pb-0'
              >
                <h4 className='text-lg font-semibold text-[#E6F56A] mb-2'>
                  {faq.question}
                </h4>
                <p className='text-white/80'>{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className='mt-20 text-center'>
          <p className='text-[#0A2E1E] mb-4'>
            Masih bingung atau butuh bantuan?
          </p>
          <Link
            href='/auth/register'
            className='inline-block bg-[#33BB5D] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#33BB5D]/90 transition-all'
          >
            Daftar Sekarang & Mulai Cuan
          </Link>
        </div>
      </div>
    </div>
  );
}
