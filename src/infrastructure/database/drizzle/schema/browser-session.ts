/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Browser Sessions Table
 *
 * The cookie jar of each named browser session (`browser/run` `session`), kept
 * between runs so a run starts signed in when the last one left it signed in.
 *
 * `jar` is SEALED: the repository encrypts it with the instance's token key
 * (`infrastructure/crypto/token-encrypt.ts`) before it is written, so no
 * cookie value can be read from the database. Named app-wide — two automations
 * naming the same session share it — and written only by a run that succeeded.
 */
export const browserSessions = systemSchema.table('browser_sessions', {
  name: text('name').primaryKey(),
  jar: text('jar').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export type BrowserSessionRow = typeof browserSessions.$inferSelect
