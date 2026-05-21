/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'


export const webhookConfigs = systemTable(
  'webhook_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    url: text('url').notNull(),
    secret: text('secret'),
    events: text('events', { mode: 'json' }).notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    tableName: text('table_name'),
    headers: text('headers', { mode: 'json' }),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index('webhook_configs_tableName_idx').on(table.tableName)]
)

export const webhookDeliveries = systemTable(
  'webhook_deliveries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: text('status').notNull().default('pending'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    error: text('error'),
    deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
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
