import Image from "next/image";

export default function HookSection() {
  return (
    <section className="relative overflow-hidden bg-white py-10">
      <div className="relative mx-auto max-w-7xl py-72 text-center">
        {/* AVATAR ATAS (TENGAH) */}
        <div className="absolute left-1/2 top-26 -translate-x-1/2">
          <Image
            src="/webp/av1.webp"
            alt="user"
            width={90}
            height={90}
            className="rounded-full"
          />
        </div>

        {/* TEXT UTAMA */}
        <h1 className="mx-auto max-w-4xl text-3xl font-semibold leading-normal text-[#0A2E1E]">
          Jangan Biarkan WhatsApp Hanya Jadi Chat. Ubah jadi alat promosi
          otomatis yang membangun relasi dan menghasilkan hingga{" "}
          <span className="text-[#33BB5D]">Rp15.000.000</span> setiap bulan.
        </h1>

        {/* Kiri Atas */}
        <div className="absolute left-16 top-42 flex items-center gap-3">
          <Image
            src="/webp/av2.webp"
            alt="user"
            width={90}
            height={90}
            className="rounded-full"
          />
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm text-green-700">
            Platform yang sangat bagus!
          </span>
        </div>

        {/* Kanan Atas */}
        <div className="absolute right-30 top-50">
          <Image
            src="/webp/av3.webp"
            alt="user"
            width={90}
            height={90}
            className="rounded-full"
          />
        </div>

        {/* Kiri Bawah */}
        <div className="absolute left-32 bottom-45">
          <Image
            src="/webp/av4.webp"
            alt="user"
            width={90}
            height={90}
            className="rounded-full"
          />
        </div>

        {/* Kanan Bawah + Bubble */}
        <div className="absolute right-24 bottom-42 flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm text-green-700">
            Sangat membantu penghasilan saya!
          </span>
          <Image
            src="/webp/av5.webp"
            alt="user"
            width={90}
            height={90}
            className="rounded-full"
          />
        </div>
      </div>
    </section>
  );
}
