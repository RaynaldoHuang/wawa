import {
  BadgeCheck,
  Check,
  DollarSign,
  MonitorCog,
  ShieldCheck,
} from 'lucide-react';

export default function HowSection() {
  return (
    <>
      <section className='bg-gray-50 py-16 px-4 md:px-6'>
        <div className='max-w-7xl mx-auto'>
          <div className='bg-white py-2 ps-2 pe-4 flex items-center gap-3 w-fit rounded-full'>
            <div className='bg-[#33BB5D] text-white p-1 rounded-full'>
              <BadgeCheck size={20} />
            </div>
            <h1 className='w-fit rounded-full text-[#0A2E1E] font-medium'>
              Keuntungan Untuk Anda
            </h1>
          </div>

          <div>
            <h1 className='text-[#0A2E1E] font-bold mt-8 text-3xl md:text-4xl lg:text-5xl'>
              Mengapa Harus GUDANG WA?
            </h1>
            <p className='text-[#0A2E1E] mt-3 font-light w-full lg:w-1/2'>
              Platform WhatsApp Automation untuk meningkatkan penghasilan,
              membangun relasi pelanggan, dan menghasilkan cuan otomatis tanpa
              ribet.
            </p>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-8 gap-5'>
              <div className='relative bg-white rounded-2xl p-8 overflow-hidden'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/2 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='bg-green-100 text-green-700 w-fit p-4 rounded-full'>
                    <DollarSign size={30} />
                  </div>

                  <h1 className='text-[#0A2E1E] mt-6 font-semibold text-xl'>
                    Cuan Hingga 15 Juta
                  </h1>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Dapatkan Rp500 - Rp1000 per pesan yang terkirim. Dengan
                    rata-rata 500 pesan per hari, potensi penghasilan mencapai
                    Rp15.000.000 per bulan.
                  </p>

                  <div className='flex flex-col gap-4 mt-6'>
                    <div className='flex items-center gap-3'>
                      <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                        <Check size={16} />
                      </div>
                      <p className='text-[#0A2E1E] font-semibold'>
                        Transfer otomatis harian ke rekening.
                      </p>
                    </div>

                    <div className='flex items-center gap-3'>
                      <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                        <Check size={16} />
                      </div>
                      <p className='text-[#0A2E1E] font-semibold'>
                        Withdraw minimal Rp50.000 kapan saja.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='relative bg-white rounded-2xl p-8 overflow-hidden'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/5 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='bg-green-100 text-green-700 w-fit p-4 rounded-full'>
                    <ShieldCheck size={30} />
                  </div>

                  <h1 className='text-[#0A2E1E] mt-6 font-semibold text-xl'>
                    Keamanan Berlapis
                  </h1>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Sistem enkripsi tingkat perbankan melindungi data Anda.
                    WhatsApp tetap aman untuk chat pribadi, hanya digunakan
                    untuk blast message legal.
                  </p>

                  <div className='flex flex-col gap-4 mt-6'>
                    <div className='flex items-center gap-3'>
                      <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                        <Check size={16} />
                      </div>
                      <p className='text-[#0A2E1E] font-semibold'>
                        SSL Certificate & 2FA Authentication.
                      </p>
                    </div>

                    <div className='flex items-center gap-3'>
                      <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                        <Check size={16} />
                      </div>
                      <p className='text-[#0A2E1E] font-semibold'>
                        Data pribadi 100% terlindungi.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='relative bg-white rounded-2xl p-8 overflow-hidden'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/5 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='bg-green-100 text-green-700 w-fit p-4 rounded-full'>
                    <MonitorCog size={30} />
                  </div>

                  <h1 className='text-[#0A2E1E] mt-6 font-semibold text-xl'>
                    Sistem Full Otomatis
                  </h1>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Set up awal hanya 5 menit, sistem bekerja sendiri. Tidur,
                    kerja atau jalan-jalan uang tetap mengalir ke rekening Anda
                    dengan semua sistem yang berjalan otomatis.
                  </p>
                </div>

                <div className='flex flex-col gap-4 mt-6'>
                  <div className='flex items-center gap-3'>
                    <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                      <Check size={16} />
                    </div>
                    <p className='text-[#0A2E1E] font-semibold'>
                      Dashboard real-time monitoring.
                    </p>
                  </div>

                  <div className='flex items-center gap-3'>
                    <div className='bg-[#33BB5D] p-1 text-white rounded-full'>
                      <Check size={16} />
                    </div>
                    <p className='text-[#0A2E1E] font-semibold'>
                      Notifikasi setiap pembayaran masuk.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
