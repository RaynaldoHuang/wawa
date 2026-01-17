import { UserStar } from 'lucide-react';

import Image from 'next/image';

import star from '@/public/webp/star.webp';
import defaultimage from '@/public/webp/avatardefault.webp';

export default function TestiSection() {
  return (
    <>
      <section className='bg-gray-50 py-16 lg:py-20'>
        <div className='max-w-7xl mx-auto flex flex-col items-center px-4 md:px-6'>
          <div className='bg-white py-2 ps-2 pe-4 flex items-center gap-3 w-fit rounded-full'>
            <div className='bg-[#33BB5D] text-white p-1 rounded-full'>
              <UserStar size={20} />
            </div>
            <h1 className='w-fit rounded-full text-[#0A2E1E] font-medium'>
              Testimonial
            </h1>
          </div>

          <div>
            <div className='w-full flex flex-col justify-center items-center'>
              <h1 className='text-[#0A2E1E] font-bold mt-8 text-3xl md:text-4xl lg:text-5xl w-full lg:w-1/2 text-center leading-tight'>
                Ribuan Orang Sudah Merasakan Manfaatnya
              </h1>
              <p className='text-[#0A2E1E] mt-6 font-light w-full lg:w-1/2 text-center'>
                Kini ribuan orang sudah merasakan bagaimana sistem ini membantu
                mereka membangun penghasilan tambahan secara otomatis dan
                berkelanjutan.
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-16 gap-5'>
              <div className='relative bg-white rounded-2xl p-8 overflow-hidden h-full'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/2 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='flex gap-1'>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Image
                        key={index}
                        src={star}
                        alt='star'
                        width={20}
                        height={20}
                      />
                    ))}
                  </div>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Sudah 3 bulan pakai Gudang WA, penghasilan stabil di 8
                    juta/bulan. Cs nya juga ramah banget dengan customernya,
                    puas banget deh pokoknya.
                  </p>

                  <div className='flex items-center gap-4 mt-4'>
                    <div className='rounded-full h-12 w-12 overflow-hidden'>
                      <Image src={defaultimage} alt='' />
                    </div>

                    <div>
                      <h1 className='text-[#0A2E1E font-semibold'>
                        Jaya Suriawan
                      </h1>
                      <p className='text-[#0A2E1E text-sm font-light'>
                        Bandung
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='relative bg-white rounded-2xl p-8 overflow-hidden h-full'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/2 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='flex gap-1'>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Image
                        key={index}
                        src={star}
                        alt='star'
                        width={20}
                        height={20}
                      />
                    ))}
                  </div>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Set up akun cuman 1 menit, gak ribet. WA nganggur semua di
                    masukkin untuk dijadikan uang tambahanku. Supportnya juga
                    fast response banget
                  </p>

                  <div className='flex items-center gap-4 mt-4'>
                    <div className='rounded-full h-12 w-12 overflow-hidden'>
                      <Image src={defaultimage} alt='' />
                    </div>

                    <div>
                      <h1 className='text-[#0A2E1E font-semibold'>
                        Siti Wahyuni
                      </h1>
                      <p className='text-[#0A2E1E text-sm font-light'>Medan</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='relative bg-white rounded-2xl p-8 overflow-hidden h-full'>
                {/* Soft inner glow */}
                <div className='absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/3 blur-3xl'></div>
                <div className='absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/2 blur-3xl'></div>

                {/* Content */}
                <div className='relative z-10'>
                  <div className='flex gap-1'>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Image
                        key={index}
                        src={star}
                        alt='star'
                        width={20}
                        height={20}
                      />
                    ))}
                  </div>

                  <p className='font-light mt-3 text-[#0A2E1E]'>
                    Punya 2 WA, aku coba masukin akunku, eee malah hasilnya gak
                    main. Lumayan banget untuk tambahan uangku. Withdraw lancar
                    dan instant. Platform terbaik.
                  </p>

                  <div className='flex items-center gap-4 mt-4'>
                    <div className='rounded-full h-12 w-12 overflow-hidden'>
                      <Image src={defaultimage} alt='' />
                    </div>

                    <div>
                      <h1 className='text-[#0A2E1E font-semibold'>
                        Ahmad Kurniawan
                      </h1>
                      <p className='text-[#0A2E1E text-sm font-light'>
                        Surakarta
                      </p>
                    </div>
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
