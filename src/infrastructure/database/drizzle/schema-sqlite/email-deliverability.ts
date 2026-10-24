/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/email-deliverability.ts` — physical tables
 * `system_email_suppressions` and `system_email_messages`. See the pg module.
 */
export const emailSuppressions = systemTable(
  'email_suppressions',
  {
    id: text('id').primaryKey(),
    address: text('address').notNull(),
    category: text('category'),
    reason: text('reason').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('email_suppressions_address_idx').on(table.address)]
)

export const emailMessages = systemTable(
  'email_messages',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id'),
    category: text('category'),
    campaign: text('campaign'),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    openedAt: integer('opened_at', { mode: 'timestamp_ms' }),
    bouncedAt: integer('bounced_at', { mode: 'timestamp_ms' }),
    complainedAt: integer('complained_at', { mode: 'timestamp_ms' }),
    unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('email_messages_campaign_idx').on(table.campaign),
    index('email_messages_message_id_idx').on(table.messageId),
  ]
)
