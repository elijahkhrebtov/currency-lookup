import { requireAccount } from '@/lib/auth'
import { api, json, readJson } from '@/lib/http'
import { getBudget, saveEntry, removeEntry } from '@/lib/repository'
import { entrySchema } from '@/lib/validation'
import { z } from 'zod'

export const GET = api(async () => json(await getBudget(await requireAccount())))
export const PUT = api(async request => {
  const accountId = await requireAccount()
  return json(await saveEntry(accountId, entrySchema.parse(await readJson(request))))
})
export const DELETE = api(async request => {
  const accountId = await requireAccount()
  const { id } = z.object({ id: z.string().min(1).max(128) }).parse(await readJson(request))
  await removeEntry(accountId, id)
  return json({ ok: true })
})
