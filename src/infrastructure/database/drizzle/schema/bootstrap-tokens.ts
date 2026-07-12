/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const sovriumBootstrapTokens = systemSchema.table('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferSelect
export type NewSovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferInsert
