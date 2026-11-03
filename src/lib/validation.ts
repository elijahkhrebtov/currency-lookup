import { z } from 'zod'

const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const entrySchema = z.object({
  id: z.string().min(1).max(128),
  description: z.string().max(500).default(''),
  kind: z.enum(['income', 'expense']),
  recurrence: z.enum(['once', 'daily', 'weekly', 'fortnightly', 'monthly']),
  date: z.iso.date(),
  amountCents: cents,
  adjustment: z.boolean().default(false),
  disabled: z.boolean().default(false),
  createdAt: cents,
}).refine(value => value.adjustment ? value.recurrence === 'once' && !value.disabled : value.amountCents > 0, 'Invalid entry or adjustment.')
export const budgetSettingsSchema = z.object({
  savingsThreshold: cents.refine(value => value > 0).nullable(),
  throughDate: z.boolean(),
})
export const currencySettingsSchema = z.object({
  currencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(5),
  source: z.string(),
  amount: z.string().regex(/^-?\d{0,15}(\.\d{0,8})?$/),
}).refine(value => new Set(value.currencies).size === value.currencies.length && value.currencies.includes(value.source), 'Invalid currency selection.')
export const ratesSchema = z.object({
  fetchedAt: z.number().finite().positive(),
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().finite().positive()),
  dates: z.record(z.string(), z.iso.date()),
}).refine(value => value.rates.USD === 1 && Object.keys(value.rates).length > 1 && Object.keys(value.rates).every(code => code === 'USD' || value.dates[code]), 'Invalid rates.')
export type Entry = z.infer<typeof entrySchema>
export type CurrencySettings = z.infer<typeof currencySettingsSchema>
export type RateData = z.infer<typeof ratesSchema>
