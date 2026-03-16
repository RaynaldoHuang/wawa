'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import logo from '@/public/webp/logo.webp';
import { cn } from '@/lib/utils';

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return;
    }

    document.body.style.overflow = '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <motion.header
      initial={false}
      animate={{ opacity: isScrolled || isOpen ? 1 : 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        `left-0 z-[70] w-full transition-[background-color,box-shadow,backdrop-filter] duration-300`,
        isScrolled || isOpen
          ? 'fixed top-0 bg-white shadow-sm border-b border-[#cfe8e3]/60'
          : 'absolute top-0 bg-transparent',
      )}
    >
      <div
        className={cn(
          'mx-auto max-w-7xl px-4 md:px-6 transition-[padding] duration-300',
          isScrolled || isOpen ? 'py-4' : 'py-6',
        )}
      >
        <div className='relative flex items-center justify-between'>
          {/* LOGO */}
          <Link href='/' className='z-[80] transition-opacity hover:opacity-80'>
            <Image src={logo} alt='Logo' className='w-32 md:w-42' />
          </Link>

          {/* DESKTOP MENU - CENTER */}
          <div className='hidden lg:block absolute left-1/2 -translate-x-1/2'>
            <nav className='flex gap-8 font-medium text-[#0E4643]'>
              <Link
                href='#keuntungan'
                className='hover:text-[#33BB5D] transition-colors'
              >
                Keuntungan
              </Link>
              <Link
                href='#cara-kerja'
                className='hover:text-[#33BB5D] transition-colors'
              >
                Cara Kerja
              </Link>
              <Link
                href='#testimoni'
                className='hover:text-[#33BB5D] transition-colors'
              >
                Testimoni
              </Link>
            </nav>
          </div>

          {/* DESKTOP MENU - RIGHT */}
          <div className='hidden lg:flex ml-auto items-center gap-8'>
            <Link
              href='/auth/login'
              className='font-medium text-[#0E4643] hover:text-[#33BB5D] transition-colors'
            >
              Masuk
            </Link>
            <Link
              href='/auth/register'
              className='rounded-full bg-[#33BB5D] px-6 py-2 font-semibold text-white cursor-pointer hover:bg-[#33BB5D]/90 transition-all'
            >
              Daftar Gratis
            </Link>
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            className='lg:hidden z-[80] text-[#0E4643]'
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* MOBILE OVERLAY */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className='fixed inset-0 z-[75] bg-white flex flex-col items-center justify-center space-y-8 lg:hidden'
              >
                <nav className='flex flex-col items-center gap-6 font-medium text-xl text-[#0E4643]'>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Link
                      href='#keuntungan'
                      onClick={() => setIsOpen(false)}
                      className='hover:text-[#33BB5D]'
                    >
                      Keuntungan
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Link
                      href='#cara-kerja'
                      onClick={() => setIsOpen(false)}
                      className='hover:text-[#33BB5D]'
                    >
                      Cara Kerja
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Link
                      href='#testimoni'
                      onClick={() => setIsOpen(false)}
                      className='hover:text-[#33BB5D]'
                    >
                      Testimoni
                    </Link>
                  </motion.div>
                </nav>

                <div className='flex flex-col items-center gap-6 mt-8'>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Link
                      href='/auth/login'
                      onClick={() => setIsOpen(false)}
                      className='font-medium text-[#0E4643] text-lg hover:text-[#33BB5D]'
                    >
                      Masuk
                    </Link>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Link
                      href='/auth/register'
                      onClick={() => setIsOpen(false)}
                      className='rounded-full bg-[#33BB5D] px-8 py-3 font-semibold text-white cursor-pointer hover:bg-[#33BB5D]/90 transition-all'
                    >
                      Daftar Gratis
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}
