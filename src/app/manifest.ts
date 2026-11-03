import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Converter & Budget', short_name: 'Budget & FX', description: 'Personal currency conversion and budget planning.',
    theme_color: '#0e131d', background_color: '#0e131d', display: 'standalone', start_url: '/', scope: '/', lang: 'en',
    icons: [
      { src: '/icons/pocket-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pocket-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pocket-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
