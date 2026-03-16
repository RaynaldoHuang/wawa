import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/portals/'], // Sembunyikan panel kontrol dari search engine
    },
    sitemap: 'https://gudangwa.com/sitemap.xml',
  };
}
