import { requireAccount } from '@/lib/auth'
import { api, json } from '@/lib/http'

export const GET = api(async () => {
  await requireAccount()
  return json({ authenticated: true })
})
