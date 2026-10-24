/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * `system.email_suppressions` — the addresses bulk sends no longer mail.
 *
 * One row per address and category: `address` is lower-cased, `category` is
 * the mailing list left, `null` for every category (a bounce, a complaint, an
 * unsubscribe without a category). A bulk `email/send` to a suppressed
 * recipient is skipped. The rows are personal data keyed by address, not by
 * account: the export lists the caller's, and erasure deletes every row of
 * the erased address.
 */
export const emailSuppressions = systemSchema.table(
  'email_suppressions',
  {
    id: text('id').primaryKey(),
    address: text('address').notNull(),
    category: text('category'),
    /** `unsubscribe` | `bounce` | `complaint`. */
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('email_suppressions_address_idx').on(table.address)]
)

/**
 * `system.email_messages` — one row per bulk or tracked message, for the
 * counts `email/stats` returns. It holds no address: an opaque reference (the
 * id the unsubscribe and open tokens carry), the transport's Message-ID (what
 * a provider's bounce report names), the category and campaign, and the time
 * of each event, the first open only.
 */
export const emailMessages = systemSchema.table(
  'email_messages',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id'),
    category: text('category'),
    campaign: text('campaign'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    bouncedAt: timestamp('bounced_at', { withTimezone: true }),
    complainedAt: timestamp('complained_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  },
  (table) => [
    index('email_messages_campaign_idx').on(table.campaign),
    index('email_messages_message_id_idx').on(table.messageId),
  ]
)
