import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loadSettings, readStorage, SETTINGS_KEY, writeStorage } from './currency'
import { request } from './lib/client'

const SYNC_KEY = 'pocket-currency.synced.v1'
const DIRTY_KEY = 'pocket-currency.dirty.v1'
const QUERY_KEY = ['currencies']
export function useCurrencySettings() {
  const client = useQueryClient()
  const [cached] = useState(() => loadSettings(false))
  const [revision, setRevision] = useState(0)
  const [storageError, setStorageError] = useState(false)
  const dirty = useRef(Boolean(cached && (!readStorage(SYNC_KEY) || readStorage(DIRTY_KEY))))
  const query = useQuery({
    queryKey: QUERY_KEY, initialData: cached ?? undefined, staleTime: Infinity, retry: false,
    queryFn: async () => {
      const settings = await request('/api/currencies')
      setStorageError(!writeStorage(SETTINGS_KEY, settings))
      writeStorage(SYNC_KEY, true)
      return settings
    },
  })
  const sync = useMutation({
    mutationKey: ['save-currencies'], scope: { id: 'currency-settings' },
    mutationFn: settings => request('/api/currencies', { method: 'PUT', body: settings }),
    onSuccess: (_saved, sent) => {
      if (JSON.stringify(client.getQueryData(QUERY_KEY)) === JSON.stringify(sent)) {
        dirty.current = false
        writeStorage(DIRTY_KEY, false)
        writeStorage(SYNC_KEY, true)
      }
    },
  })
  const mutateRef = useRef(sync.mutate)
  useEffect(() => { mutateRef.current = sync.mutate }, [sync.mutate])
  useEffect(() => {
    if (!dirty.current || !query.data) return
    const timer = setTimeout(() => {
      if (navigator.onLine) mutateRef.current(client.getQueryData(QUERY_KEY))
    }, 350)
    return () => clearTimeout(timer)
  }, [revision, query.data, client])
  useEffect(() => {
    const retry = () => { if (dirty.current) setRevision(value => value + 1) }
    const visible = () => { if (document.visibilityState === 'visible') retry() }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  function setSettings(update) {
    const previous = client.getQueryData(QUERY_KEY)
    const settings = typeof update === 'function' ? update(previous) : update
    dirty.current = true
    const written = writeStorage(SETTINGS_KEY, settings)
    const marked = writeStorage(DIRTY_KEY, true)
    setStorageError(!written || !marked)
    client.setQueryData(QUERY_KEY, settings)
    setRevision(value => value + 1)
  }
  return { settings: query.data, setSettings, loading: query.isPending, error: query.error, storageError, syncError: sync.error, retry: () => {
    if (!query.data) query.refetch()
    else setRevision(value => value + 1)
  } }
}
