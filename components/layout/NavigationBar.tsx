import Image from "next/image";
import Link from "next/link";
import logo from "@/public/webp/logo.webp";

export default function NavBar() {
  return (
    <header className="absolute top-0 left-0 z-50 w-full">
      <div className="mx-auto max-w-7xl py-6">
        <div className="relative flex items-center">
          {/* LOGO */}
          <div>
            <Image src={logo} alt="Logo" className="w-42" />
          </div>

          {/* CENTER MENU */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <nav className="flex gap-8 font-medium text-[#0E4643]">
              <Link href="">Keuntungan</Link>
              <Link href="">Cara Kerja</Link>
              <Link href="">Testimoni</Link>
            </nav>
          </div>

          {/* RIGHT */}
          <div className="ml-auto flex items-center gap-8">
            <Link href="" className="font-medium text-[#0E4643]">
              Masuk
            </Link>
            <button className="rounded-full bg-[#33BB5D] px-6 py-2 font-semibold text-white cursor-pointer hover:bg-[#33BB5D]/90 transition-all">
              Daftar Gratis
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
