import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean),
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'same-origin' },
      ] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ]
  },
}
export default config
