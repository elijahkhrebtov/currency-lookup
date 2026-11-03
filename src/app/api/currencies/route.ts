import { requireAccount } from '@/lib/auth'
import { api, json, readJson } from '@/lib/http'
import { getCurrencySettings, saveCurrencySettings } from '@/lib/repository'
import { currencySettingsSchema } from '@/lib/validation'

export const GET = api(async () => json(await getCurrencySettings(await requireAccount())))
export const PUT = api(async request => {
  const accountId = await requireAccount()
  return json(await saveCurrencySettings(accountId, currencySettingsSchema.parse(await readJson(request))))
})
