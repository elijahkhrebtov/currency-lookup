import { useCallback, useEffect, useRef, useState } from 'react'
import { DAY, loadRates, parseRates, RATES_KEY, writeStorage } from './currency'

export function useRates() {
  const [data, setData] = useState(loadRates)
  const dataRef = useRef(data)
  const active = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [checkedAt, setCheckedAt] = useState(Date.now)

  const refresh = useCallback(async (force = false) => {
    setCheckedAt(Date.now())
    if (active.current || (!force && dataRef.current && Date.now() - dataRef.current.fetchedAt < DAY)) return
    if (!navigator.onLine) {
      setError('You’re offline. Reconnect to refresh rates.')
      return
    }
    const controller = new AbortController()
    active.current = controller
    const timeout = setTimeout(() => controller.abort(), 15000)
    setLoading(true)
    setError('')
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD', {
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Rate request failed')
      const next = parseRates(await response.json())
      dataRef.current = next
      setData(next)
      setStorageError(!writeStorage(RATES_KEY, next))
    } catch {
      setError('Couldn’t refresh rates. Please try again.')
    } finally {
      clearTimeout(timeout)
      active.current = null
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // This effect synchronizes the UI with the external rate service.
    // oxlint-disable-next-line react/set-state-in-effect
    refresh()
    const onOnline = () => { setOnline(true); refresh() }
    const onOffline = () => setOnline(false)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => refresh(), 60 * 60 * 1000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const stale = data && checkedAt - data.fetchedAt >= DAY
  return { data, loading, error, online, storageError, stale, refresh }
}
