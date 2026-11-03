import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DAY, loadRates, RATES_KEY, writeStorage } from './currency'
import { request } from './lib/client'
import { ratesSchema } from './lib/validation'

export function useRates() {
  const client = useQueryClient()
  const [cached] = useState(loadRates)
  const [online, setOnline] = useState(navigator.onLine)
  const [storageError, setStorageError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [checkedAt, setCheckedAt] = useState(Date.now)
  const query = useQuery({
    queryKey: ['rates'], initialData: cached ?? undefined, initialDataUpdatedAt: cached?.fetchedAt,
    staleTime: DAY, retry: false,
    refetchInterval: 60 * 60 * 1000,
    queryFn: async () => {
      setCheckedAt(Date.now())
      const current = client.getQueryData(['rates'])
      if (current && Date.now() - current.fetchedAt < DAY) return current
      const next = ratesSchema.parse(await request('/api/rates'))
      setStorageError(!writeStorage(RATES_KEY, next))
      return next
    },
  })
  useEffect(() => {
    const onOnline = () => { setOnline(true); setCheckedAt(Date.now()) }
    const onOffline = () => setOnline(false)
    const onVisible = () => { if (document.visibilityState === 'visible') setCheckedAt(Date.now()) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  async function refresh() {
    setCheckedAt(Date.now())
    setRefreshing(true)
    setRefreshError('')
    try {
      const next = ratesSchema.parse(await request('/api/rates', { method: 'POST' }))
      setStorageError(!writeStorage(RATES_KEY, next))
      client.setQueryData(['rates'], next)
    } catch (error) { setRefreshError(error.message) }
    finally { setRefreshing(false) }
  }
  return { data: query.data, loading: query.isFetching || refreshing, error: refreshError || query.error?.message || '', online, storageError, stale: query.data && checkedAt - query.data.fetchedAt >= DAY, refresh }
}
