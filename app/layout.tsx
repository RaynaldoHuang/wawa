import AppProvider from '@/providers/AppProvider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | Gudang WA',
    default: 'Gudang WA - Platform WhatsApp Blast Pertama di Indonesia',
  },
  description:
    'Gudang WA adalah platform pengiriman pesan WhatsApp massal otomatis dengan keamanan terjamin. Dapatkan penghasilan dengan menghubungkan nomor WhatsApp Anda.',
  keywords: [
    'whatsapp blast',
    'wa blast',
    'kirim pesan massal',
    'marketing whatsapp',
    'wa marketing',
    'api whatsapp',
    'gudang wa',
  ],
  authors: [{ name: 'Ciptacode' }],
  metadataBase: new URL('https://gudangwa.com'), // Ganti dengan domain produksi Anda
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://gudangwa.com',
    siteName: 'Gudang WA',
    title: 'Gudang WA - Platform WhatsApp Blast Terpercaya',
    description:
      'Solusi pengiriman pesan WhatsApp massal otomatis untuk bisnis Anda. Cepat, aman, dan efisien.',
    images: [
      {
        url: '/webp/logo.webp', // Gunakan logo sebagai fallback image jika belum ada open-graph image khusus
        width: 1200,
        height: 630,
        alt: 'Gudang WA Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gudang WA - WhatsApp Blast Otomatis',
    description:
      'Optimalkan bisnis Anda dengan layanan WhatsApp Blast terbaik dari Gudang WA.',
    images: ['/webp/logo.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
