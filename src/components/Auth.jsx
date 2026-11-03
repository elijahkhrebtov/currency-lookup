'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { request, clearPrivateData } from '../lib/client'
import { readStorage, writeStorage } from '../currency'
import { AppSkeleton } from './Skeleton'

export default function Auth({ children }) {
  const client = useQueryClient()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      if (!navigator.onLine && readStorage('pocket.signed-in.v1')) return { authenticated: true }
      try {
        const data = await request('/api/auth/session')
        writeStorage('pocket.signed-in.v1', true)
        return data
      } catch (error) {
        if (error.status === 401) {
          writeStorage('pocket.signed-in.v1', false)
          return { authenticated: false }
        }
        throw error
      }
    },
    retry: false, staleTime: 5 * 60 * 1000, refetchInterval: 6 * 60 * 60 * 1000, networkMode: 'always',
  })
  useEffect(() => {
    const expired = async () => {
      writeStorage('pocket.signed-in.v1', false)
      await clearPrivateData(client)
    }
    window.addEventListener('pocket:unauthorized', expired)
    return () => window.removeEventListener('pocket:unauthorized', expired)
  }, [client])
  if (session.isPending) return <AppSkeleton />
  if (session.data?.authenticated) return children
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await request('/api/auth/login', { method: 'POST', body: { secret } })
      writeStorage('pocket.signed-in.v1', true)
      setSecret('')
      client.setQueryData(['session'], { authenticated: true })
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <h1>Converter &amp; Budget</h1><p>Enter your secret key to sign in.</p>
    <label htmlFor="secret">Secret key</label><input id="secret" type="password" autoComplete="current-password" required maxLength={2048} value={secret} onChange={event => setSecret(event.target.value)} disabled={busy} />
    <div className="login-feedback" aria-live="polite">{(error || session.error) && <p role="alert">{error || session.error.message}</p>}</div>
    <button className="save-entry-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="login-note">You’ll stay signed in on this device.</p>
  </form></main>
}
