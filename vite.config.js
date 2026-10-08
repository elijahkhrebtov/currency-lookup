import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'icons/*.png'],
    manifest: {
      id: '/',
      name: 'Pocket — Currency Converter',
      short_name: 'Pocket',
      description: 'Your currencies, one amount. A quick currency converter that works offline.',
      theme_color: '#0e131d',
      background_color: '#0e131d',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      lang: 'en',
      icons: [
        { src: '/icons/pocket-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pocket-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/pocket-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  })],
})
