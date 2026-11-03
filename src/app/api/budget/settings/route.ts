import { requireAccount } from '@/lib/auth'
import { api, json, readJson } from '@/lib/http'
import { saveBudgetSettings, initializeBudgetSettings } from '@/lib/repository'
import { budgetSettingsSchema } from '@/lib/validation'

export const PUT = api(async request => {
  const accountId = await requireAccount()
  return json(await saveBudgetSettings(accountId, budgetSettingsSchema.parse(await readJson(request))))
})
// One-time migration of a legacy browser threshold; never replace a server value.
export const POST = api(async request => {
  const accountId = await requireAccount()
  return json(await initializeBudgetSettings(accountId, budgetSettingsSchema.parse(await readJson(request))))
})
