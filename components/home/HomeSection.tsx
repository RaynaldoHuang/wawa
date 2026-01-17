import Image from 'next/image';

import img from '@/public/webp/img1.webp';

export default function HomeSection() {
  return (
    <>
      <section>
        <div className='relative h-auto lg:h-207.5 overflow-hidden bg-[#F9FBF9]'>
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

          <div className='max-w-7xl mx-auto h-full flex flex-col justify-end px-4 md:px-6 lg:px-8'>
            <div className='flex flex-col-reverse lg:grid lg:grid-cols-2 items-center gap-10 lg:space-x-10 py-10 lg:py-0'>
              <div className='z-10'>
                <div>
                  <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-[#0A2E1E] leading-tight tracking-tight text-center lg:text-left'>
                    Raih Cuan dari{' '}
                    <span className='bg-[#33BB5D]/30 px-2 '>WhatsApp</span>,
                    <br />
                    yang Selama Ini Menganggur.
                  </h1>
                  <p className='mt-6 text-base lg:text-lg text-gray-600 max-w-md mx-auto lg:mx-0 text-center lg:text-left'>
                    Otomatiskan promosi, bangun kedekatan dengan pelanggan, dan
                    hasilkan hingga Rp 15 juta per bulan secara konsisten.
                  </p>

                  <div className='mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start'>
                    <button className='bg-[#33BB5D] text-white px-6 py-3 cursor-pointer rounded-xl font-medium hover:bg-[#33BB5D]/90 transition-all text-sm lg:text-base w-full sm:w-auto'>
                      Mulai Sekarang
                    </button>
                    <button className='border border-gray-300 bg-white/50 text-[#0A2E1E] px-8 py-3 rounded-xl font-medium hover:bg-white transition-all cursor-pointer text-sm lg:text-base w-full sm:w-auto'>
                      Cara Kerja Gudang WA
                    </button>
                  </div>
                </div>
              </div>

              <div className='relative z-10 w-full flex justify-center lg:block'>
                <div className='relative flex justify-center lg:mt-0'>
                  {/* Lingkaran dekoratif di belakang orang */}{' '}
                  <div className='absolute w-180 h-180 top-20 bg-[#33BB5D]/10 rounded-full items-center flex justify-center'>
                    {' '}
                    <div className='w-155 h-155 bg-[#33BB5D]/10 rounded-full'></div>{' '}
                  </div>
                  <div className='relative h-200 top-10 z-20 rounded-2xl flex items-center justify-center'>
                    <Image
                      src={img}
                      alt='Hero Image'
                      className='w-full h-full object-cover'
                    />
                  </div>
                </div>

                <div className='absolute right-0 bottom-20 bg-white rounded-xl shadow-lg p-4 w-50 z-50'>
                  <p className='text-xs text-gray-500'>Credit Card</p>
                  <p className='font-semibold text-sm'>**** 2345</p>
                  <p className='mt-2 text-green-600 font-bold'>Rp10.000.000</p>
                </div>

                {/* CARD KANAN ATAS */}
                <div className='absolute right-0 top-40 bg-[#1F3D3A] text-white rounded-xl shadow-md p-4 w-37.5'>
                  <p className='text-xs opacity-80'>Pendapatan</p>
                  <p className='text-lg font-bold'>Rp3.450.340</p>
                </div>

                {/* CARD KANAN BAWAH */}
                <div className='absolute -left-10 top-48 bg-white rounded-xl shad p-4 w-45'>
                  <p className='text-xs text-gray-500'>Total Saldo</p>
                  <p className='text-xl font-bold'>Rp50.876.580</p>
                  <p className='text-xs text-green-600 mt-1'>+12% this month</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
