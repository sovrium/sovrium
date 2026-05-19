/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const webhookConfigs = systemSchema.table(
  'webhook_configs',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    url: text('url').notNull(),
    secret: text('secret'),
    events: jsonb('events').notNull(),
    active: boolean('active').notNull().default(true),
    tableName: text('table_name'),
    headers: jsonb('headers'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('webhook_configs_tableName_idx').on(table.tableName)]
)

export const webhookDeliveries = systemSchema.table(
  'webhook_deliveries',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: text('status').notNull().default('pending'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    error: text('error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_webhookId_idx').on(table.webhookId),
    index('webhook_deliveries_status_idx').on(table.status),
    index('webhook_deliveries_createdAt_idx').on(table.createdAt),
  ]
)

export type WebhookConfig = typeof webhookConfigs.$inferSelect
export type NewWebhookConfig = typeof webhookConfigs.$inferInsert
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert
