import { openDB } from 'idb'

export type EntryKind = 'expense' | 'income'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'fortnightly' | 'monthly'

export interface Entry {
  id: string
  description: string
  kind: EntryKind
  recurrence: Recurrence
  /** YYYY-MM-DD; for recurring entries, the first day of the series */
  date: string
  /** Positive amount in cents; adjustments may be zero */
  amountCents: number
  /** Fixed one-time balance correction; only deletion is allowed */
  adjustment?: boolean
  /** Temporarily excluded from calculations */
  disabled?: boolean
  createdAt: number
}

let dbPromise: ReturnType<typeof openDB> | undefined

function database() {
  return dbPromise ??= openDB('budget', 1, {
    upgrade(db) {
      db.createObjectStore('entries', { keyPath: 'id' })
    },
  }).catch((error) => { dbPromise = undefined; throw error })
}

export async function getAllEntries(): Promise<Entry[]> {
  return (await database()).getAll('entries')
}

export async function putEntry(entry: Entry): Promise<void> {
  await (await database()).put('entries', entry)
}

export async function deleteEntry(id: string): Promise<void> {
  await (await database()).delete('entries', id)
}

export async function putEntries(entries: Entry[]): Promise<void> {
  const tx = (await database()).transaction('entries', 'readwrite')
  await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done])
}
