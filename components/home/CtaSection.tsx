import { Check } from "lucide-react";

export default function CtaSection() {
  return (
    <>
      <section className="py-24">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div>
            <div className="w-full flex flex-col justify-center items-center">
              <h1 className="text-[#0A2E1E] font-bold mt-8 text-5xl text-center leading-tight">
                Mulai <span className="text-[#33BB5D]">Menghasilkan Uang</span>{" "}
                Hari Ini Juga
              </h1>
              <p className="text-[#0A2E1E] mt-6 font-light w-2/3 text-center">
                Bergabunglah dengan 10 Juta user yang sudah merasakan manfaat
                platform WhatsApp blast. Gratis selamanya, tanpa biaya
                tersembunyi!
              </p>
            </div>

            <div className="mt-8 flex gap-4 justify-center items-center">
              <button className="bg-[#33BB5D] text-white px-6 py-3 cursor-pointer rounded-xl font-medium hover:bg-[#33BB5D]/90 transition-all">
                Daftar Gratis Sekarang
              </button>
              <button className="border border-gray-300 bg-white/50 text-[#0A2E1E] px-8 py-3 rounded-xl font-medium hover:bg-white transition-all cursor-pointer">
                Sudah Punya Akun
              </button>
            </div>

            <div className="flex gap-8 mt-10 justify-center items-center">
              <div className="flex items-center gap-3">
                <div className="bg-[#33BB5D] p-1 text-white rounded-full">
                  <Check size={16} />
                </div>
                <p className="text-[#0A2E1E] font-semibold">Gratis Selamanya</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-[#33BB5D] p-1 text-white rounded-full">
                  <Check size={16} />
                </div>
                <p className="text-[#0A2E1E] font-semibold">Set Up 5 Menit</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-[#33BB5D] p-1 text-white rounded-full">
                  <Check size={16} />
                </div>
                <p className="text-[#0A2E1E] font-semibold">8000+ User Aktif</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
