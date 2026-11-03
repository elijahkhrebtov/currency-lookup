'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppSkeleton } from './Skeleton'
import Auth from './Auth'

const App = dynamic(() => import('../App'), { ssr: false, loading: AppSkeleton })
export default function Client() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return <QueryClientProvider client={client}><Auth><App /></Auth></QueryClientProvider>
}
