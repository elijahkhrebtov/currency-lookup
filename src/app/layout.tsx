/* oxlint-disable react/only-export-components -- Next.js metadata convention. */
import type { Metadata, Viewport } from 'next'
import '../index.css'
import '../App.css'
import '../budget/Budget.css'

export const metadata: Metadata = {
  title: 'Converter & Budget', description: 'Personal currency conversion and budget planning.',
  manifest: '/manifest.webmanifest', icons: { icon: '/favicon.svg', apple: '/icons/pocket-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0e131d', interactiveWidget: 'resizes-content' }
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
