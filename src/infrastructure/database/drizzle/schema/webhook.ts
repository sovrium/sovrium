/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Webhook Configs Table
 *
 * Outgoing webhook endpoint configurations (URL, secret, events, active status).
 */
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

/**
 * Webhook Deliveries Table
 *
 * Outgoing webhook delivery log (attempt tracking, status, response).
 */
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

/**
 * Webhook Outbox Table
 *
 * One row per delivery a committed record write owes a table webhook, written
 * in the same transaction as the record (`record-webhook-dispatcher.ts`). The
 * row's `id` is the delivery id every attempt sends as `X-Sovrium-Delivery-Id`.
 * `payload` is the body as built at write time; no credential is ever stored —
 * auth headers and signatures are computed at each attempt. A row leaves
 * `pending` as `delivered` or `dead`, and is deleted seven days after.
 */
export const webhookOutbox = systemSchema.table(
  'webhook_outbox',
  {
    id: text('id').primaryKey(),
    tableName: text('table_name').notNull(),
    webhookName: text('webhook_name').notNull(),
    event: text('event').notNull(),
    recordId: text('record_id').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastHttpStatus: integer('last_http_status'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (table) => [
    index('webhook_outbox_status_nextAttemptAt_idx').on(table.status, table.nextAttemptAt),
    index('webhook_outbox_tableName_recordId_idx').on(table.tableName, table.recordId),
  ]
)

/**
 * Webhook Outbox Subjects Table
 *
 * The users an outbox row's payload names (the values of the record's `user`,
 * `created-by`, `updated-by` and `deleted-by` fields, previous values
 * included), so erasing a user removes every delivery about her.
 */
export const webhookOutboxSubjects = systemSchema.table(
  'webhook_outbox_subjects',
  {
    outboxId: text('outbox_id')
      .notNull()
      .references(() => webhookOutbox.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
  },
  (table) => [
    index('webhook_outbox_subjects_userId_idx').on(table.userId),
    index('webhook_outbox_subjects_outboxId_idx').on(table.outboxId),
  ]
)

// Type inference
export type WebhookConfig = typeof webhookConfigs.$inferSelect
export type NewWebhookConfig = typeof webhookConfigs.$inferInsert
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert
