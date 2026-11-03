import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, integer, bigint, boolean, jsonb, primaryKey, check, index } from 'drizzle-orm/pg-core'
import type { CurrencySettings, RateData } from '../validation'

export const accounts = pgTable('pocket_accounts', {
  id: text('id').primaryKey(),
  secretHash: text('secret_hash').notNull(),
})
export const sessions = pgTable('pocket_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  renewedAt: timestamp('renewed_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('pocket_sessions_expiry_idx').on(table.expiresAt)])
export const loginAttempts = pgTable('pocket_login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull().default(1),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
})
export const entries = pgTable('pocket_budget_entries', {
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  description: text('description').notNull(),
  kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
  recurrence: text('recurrence', { enum: ['once', 'daily', 'weekly', 'fortnightly', 'monthly'] }).notNull(),
  date: text('date').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  adjustment: boolean('adjustment').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, table => [
  primaryKey({ columns: [table.accountId, table.id] }),
  check('pocket_entry_amount', sql`${table.amountCents} >= 0 and (${table.adjustment} or ${table.amountCents} > 0)`),
  check('pocket_entry_kind', sql`${table.kind} in ('income', 'expense')`),
  check('pocket_entry_recurrence', sql`${table.recurrence} in ('once', 'daily', 'weekly', 'fortnightly', 'monthly')`),
  check('pocket_entry_adjustment', sql`not ${table.adjustment} or (${table.recurrence} = 'once' and not ${table.disabled})`),
])
export const budgetSettings = pgTable('pocket_budget_settings', {
  accountId: text('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  savingsThreshold: bigint('savings_threshold', { mode: 'number' }),
  throughDate: boolean('through_date').notNull().default(false),
})
export const currencySettings = pgTable('pocket_currency_settings', {
  accountId: text('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').$type<CurrencySettings>().notNull(),
})
export const rateCache = pgTable('pocket_rate_cache', {
  id: text('id').primaryKey(),
  data: jsonb('data').$type<RateData>().notNull(),
})
