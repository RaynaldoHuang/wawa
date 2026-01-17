import { Check, Workflow } from "lucide-react";

import Image from "next/image";

import avatar from "@/public/webp/avatar.webp";
import wedeh from "@/public/webp/withdraw.webp";

import form from "@/public/webp/form.webp";

export default function FlowSection() {
  return (
    <>
      <section>
        <div className="max-w-7xl mx-auto">
          <div className="py-28">
            <div className="bg-gray-50 py-2 ps-2 pe-4 flex items-center gap-3 w-fit rounded-full">
              <div className="bg-[#33BB5D] text-white p-1 rounded-full">
                <Workflow size={20} />
              </div>
              <h1 className="w-fit rounded-full text-[#0A2E1E] font-medium">
                Cara Kerja GUDANG WA
              </h1>
            </div>
            <div className="flex mt-8 gap-16">
              <h1 className="text-[#0A2E1E] font-bold text-5xl leading-tight">
                Mulai Hasilkan dalam 3 Langkah Mudah
              </h1>
              <p className="text-[#0A2E1E] mt-3 font-light w-1/2 text-right">
                Mulai hasilkan uang dari WhatsApp dalam waktu kurang dari 5
                menit tanpa ribet, tanpa teknis rumit, dan tanpa harus jualan
                setiap hari.
              </p>
            </div>

            <div>
              <div className="mt-10">
                <div className="bg-[#33BB5D] py-6 px-16 rounded-2xl flex gap-20 items-center">
                  <div className="w-1/2">
                    <h1 className="text-4xl text-white font-semibold">
                      Daftar akun gratis sekarang dan mulai rasakan kemudahannya
                      tanpa biaya apa pun.
                    </h1>
                    <p className="text-white font-light mt-4">
                      Proses verifikasi instant, tidak perlu survei panjang atau
                      dokumen ribet. 100% gratis selamanya, tanpa biaya
                      tersembunyi!
                    </p>

                    <div className="flex gap-8 mt-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-white p-1 text-[#33BB5D] rounded-full">
                          <Check size={16} />
                        </div>
                        <p className="text-white font-semibold">
                          Verifikasi Instant 1 Menit
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="bg-white p-1 text-[#33BB5D] rounded-full">
                          <Check size={16} />
                        </div>
                        <p className="text-white font-semibold">
                          Gratis Tanpa Biaya Apapun
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2">
                    <Image
                      src={form}
                      alt="flow image"
                      className="relative z-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 mt-6 gap-6 items-stretch">
              {/* CARD LEFT */}
              <div className="h-full">
                <div className="relative bg-gray-50 rounded-2xl p-12 overflow-hidden h-full flex flex-col">
                  {/* Soft inner glow */}
                  <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#25D366]/10 blur-3xl"></div>
                  <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#FEEA3B]/3 blur-3xl"></div>

                  {/* IMAGE */}
                  <div className="relative z-10 h-52 flex items-center justify-center">
                    <Image
                      src={avatar}
                      alt="avatar"
                      className="max-h-full object-contain px-10"
                    />
                  </div>

                  {/* TEXT */}
                  <div className="mt-8 flex-1">
                    <h1 className="text-4xl text-[#0A2E1E] font-semibold leading-tight">
                      Hubungkan WhatsApp yang Nganggur Untuk Hasilkan Uang.
                    </h1>
                    <p className="text-[#0A2E1E] font-light mt-4">
                      Scan QR Code menggunakan WhatsApp Anda, persis sama dengan
                      WhatsApp Web. Dalam 2 menit, WhatsApp Anda siap
                      menghasilkan uang.
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD RIGHT */}
              <div className="h-full">
                <div className="relative bg-gray-50 rounded-2xl p-12 overflow-hidden h-full flex flex-col">
                  {/* Soft inner glow */}
                  <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#FEEA3B]/3 blur-3xl"></div>
                  <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#25D366]/8 blur-3xl"></div>

                  {/* IMAGE */}
                  <div className="relative z-10 h-52 flex items-center justify-center">
                    <Image
                      src={wedeh}
                      alt="withdraw"
                      className="max-h-full object-contain px-10"
                    />
                  </div>

                  {/* TEXT */}
                  <div className="mt-8 flex-1">
                    <h1 className="text-4xl text-[#0A2E1E] font-semibold leading-tight">
                      Terima dan withdraw uang kamu secara otomatis.
                    </h1>
                    <p className="text-[#0A2E1E] font-light mt-4">
                      Setiap pesan terkirim sama dengan uang masuk. Bayaran
                      Rp500 - Rp1000 per pesan langsung ditransfer ke rekening
                      atau e-wallet Anda.
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
