export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options, cache: 'no-store',
    signal: options.signal ?? AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !path.includes('/auth/')) window.dispatchEvent(new Event('pocket:unauthorized'))
    const error = new Error(data?.error || 'Request failed. Please try again.')
    error.status = response.status
    throw error
  }
  if (data === null) throw new Error('Could not read the response. Please try again.')
  return data
}

export async function clearPrivateData(client) {
  await client.cancelQueries()
  // Keep the observed session query so its subscribers see the signed-out state.
  client.removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
  client.getMutationCache().clear()
  client.setQueryData(['session'], { authenticated: false })
}

export function draftId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
