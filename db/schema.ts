import {
  pgTable,
  uuid,
  text,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// leads
// ---------------------------------------------------------------------------
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  company: text("company"), // optional — nullable by default
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// audits
// ---------------------------------------------------------------------------
export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  totalCurrentSpend: numeric("total_current_spend", {
    precision: 12,
    scale: 2,
  }).notNull(),
  totalMonthlySavings: numeric("total_monthly_savings", {
    precision: 12,
    scale: 2,
  }).notNull(),
  totalAnnualSavings: numeric("total_annual_savings", {
    precision: 12,
    scale: 2,
  }).notNull(),
  primaryUseCase: text("primary_use_case").notNull(),
  /** Stores the raw array of user-submitted tool objects as validated JSONB. */
  toolsData: jsonb("tools_data").notNull(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations (for Drizzle relational query API)
// ---------------------------------------------------------------------------
export const leadsRelations = relations(leads, ({ many }) => ({
  audits: many(audits),
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  lead: one(leads, {
    fields: [audits.leadId],
    references: [leads.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types — use these throughout the application layer
// ---------------------------------------------------------------------------
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

export type Audit = typeof audits.$inferSelect;
export type NewAudit = typeof audits.$inferInsert;
