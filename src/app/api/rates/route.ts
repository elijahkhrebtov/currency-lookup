import { requireAccount } from '@/lib/auth'
import { api, json, assertSameOrigin } from '@/lib/http'
import { getRates } from '@/lib/repository'

export const GET = api(async () => {
  await requireAccount()
  return json(await getRates(false))
})
export const POST = api(async request => {
  assertSameOrigin(request)
  await requireAccount()
  return json(await getRates(true))
})
