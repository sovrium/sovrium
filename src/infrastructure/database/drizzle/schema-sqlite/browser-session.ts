/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Browser Sessions Table — sqlite-core mirror of `schema/browser-session.ts`.
 *
 * The sealed cookie jar of each named browser session; see the PostgreSQL
 * definition for why the jar is encrypted before it is written.
 */
export const browserSessions = systemTable('browser_sessions', {
  name: text('name').primaryKey(),
  jar: text('jar').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
})

export type BrowserSessionRow = typeof browserSessions.$inferSelect
