/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/design-system-shares.ts` — physical table
 * `system_design_system_shares`.
 *
 * Every exported identifier matches the pg-core module so the runtime barrel
 * swap stays transparent to importers. See the pg module for why the plaintext
 * token has no column here and why revocation is a timestamp rather than a
 * delete.
 */
export const designSystemShares = systemTable(
  'design_system_shares',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appName: text('app_name').notNull().default('default'),
    tokenHash: text('token_hash').notNull(),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('design_system_shares_token_hash_unique').on(table.tokenHash),
    index('design_system_shares_app_revoked_idx').on(table.appName, table.revokedAt),
  ]
)

export type DesignSystemShare = typeof designSystemShares.$inferSelect
export type NewDesignSystemShare = typeof designSystemShares.$inferInsert
