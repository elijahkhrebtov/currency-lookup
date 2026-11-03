CREATE TABLE "pocket_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_budget_settings" (
	"account_id" text PRIMARY KEY NOT NULL,
	"savings_threshold" bigint,
	"through_date" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_currency_settings" (
	"account_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_budget_entries" (
	"account_id" text NOT NULL,
	"id" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"recurrence" text NOT NULL,
	"date" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"adjustment" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "pocket_budget_entries_account_id_id_pk" PRIMARY KEY("account_id","id"),
	CONSTRAINT "pocket_entry_amount" CHECK ("pocket_budget_entries"."amount_cents" >= 0 and ("pocket_budget_entries"."adjustment" or "pocket_budget_entries"."amount_cents" > 0)),
	CONSTRAINT "pocket_entry_kind" CHECK ("pocket_budget_entries"."kind" in ('income', 'expense')),
	CONSTRAINT "pocket_entry_recurrence" CHECK ("pocket_budget_entries"."recurrence" in ('once', 'daily', 'weekly', 'fortnightly', 'monthly')),
	CONSTRAINT "pocket_entry_adjustment" CHECK (not "pocket_budget_entries"."adjustment" or ("pocket_budget_entries"."recurrence" = 'once' and not "pocket_budget_entries"."disabled"))
);
--> statement-breakpoint
CREATE TABLE "pocket_login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_rate_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"renewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pocket_budget_settings" ADD CONSTRAINT "pocket_budget_settings_account_id_pocket_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pocket_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_currency_settings" ADD CONSTRAINT "pocket_currency_settings_account_id_pocket_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pocket_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_budget_entries" ADD CONSTRAINT "pocket_budget_entries_account_id_pocket_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pocket_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_sessions" ADD CONSTRAINT "pocket_sessions_account_id_pocket_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."pocket_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pocket_sessions_expiry_idx" ON "pocket_sessions" USING btree ("expires_at");