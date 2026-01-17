import Image from 'next/image';
import Link from 'next/link';

import logo from '@/public/webp/logo.webp';

export default function FooterSection() {
  return (
    <>
      <section>
        <div className='relative overflow-hidden bg-[#F9FBF9]'>
          {/* GRADIENT ATAS KIRI */}
          <div
            className='absolute top-[-15%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-30'
            style={{
              background:
                'radial-gradient(circle, #E6F56A 0%, transparent 65%)',
            }}
          />
          {/* GRADIENT KANAN ATAS */}
          <div
            className='absolute right-[-15%] top-[10%] w-[45%] h-[55%] rounded-full blur-[140px] opacity-35'
            style={{
              background:
                'radial-gradient(circle, #CFE8E3 0%, transparent 70%)',
            }}
          />

          {/* GRADIENT BAWAH */}
          <div
            className='absolute bottom-[-35%] left-1/2 -translate-x-1/2 w-[70%] h-[50%] rounded-full blur-[160px] opacity-35'
            style={{
              background:
                'radial-gradient(circle, #14532D 0%, transparent 40%)',
            }}
          />

          <div className='absolute inset-0 bg-white/10 backdrop-blur-[2px]'></div>

          <div className='relative max-w-7xl mx-auto z-99 py-16 px-4 md:px-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32'>
              <div className='flex flex-col'>
                <div>
                  <Image src={logo} alt='logo' className='w-60' />
                </div>
                <p className='text-[#0A2E1E] font-normal mt-4'>
                  Platform WhatsApp blast pertama di Indonesia. Sistem
                  pembayaran otomatis dan keamanan terjamin. Sudah dipercaya
                  10JT+ user aktif.
                </p>
              </div>

              <div className='grid grid-cols-2 gap-8 md:gap-16'>
                <div className='flex flex-col'>
                  <h1 className='font-semibold text-[#14603e] text-xl'>
                    Platform
                  </h1>

                  <div className='flex flex-col mt-6 gap-3'>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Keuntungan
                    </Link>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Cara Kerja
                    </Link>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Testimoni
                    </Link>
                  </div>
                </div>

                <div className='flex flex-col'>
                  <h1 className='font-semibold text-[#14603e] text-xl'>
                    Bantuan
                  </h1>

                  <div className='flex flex-col mt-6 gap-3'>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Kebijakan Privasi
                    </Link>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Live Chat
                    </Link>
                    <Link href={''} className='font-medium text-[#0A2E1E]'>
                      Panduan
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* DIVIDER */}
            <div className='mt-16 border-t border-[#0A2E1E]/50'></div>

            {/* COPYRIGHT */}
            <div className='mt-6 flex justify-center'>
              <p className='text-sm text-[#0A2E1E]'>
                ©{new Date().getFullYear()} Gudang WA. All Rights Reserved.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
