/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  BrowserSessionDatabaseError,
  BrowserSessionRepository,
} from '@/application/ports/repositories/automations/browser-session-repository'
import { decryptToken, encryptToken } from '@/infrastructure/crypto/token-encrypt'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { browserSessions as browserSessionsPg } from '@/infrastructure/database/drizzle/schema/browser-session'
import { browserSessions as browserSessionsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/browser-session'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { logError } from '@/infrastructure/logging/logger'

const browserSessions = resolveDialectSchema(browserSessionsPg, browserSessionsSqlite)

const wrap = makeDbWrap((cause) => new BrowserSessionDatabaseError({ cause }))

/**
 * The jar, opened — or `undefined` for one this key cannot open (the instance
 * key changed): the run then starts signed out, as with no stored session. The
 * failure is logged with its cause and the session's name, so a sign-in that
 * keeps coming back is traced to the key rather than to the site.
 */
const openJar = (name: string, sealed: string): string | undefined => {
  try {
    return decryptToken(sealed)
  } catch (error) {
    logError(
      `[browser] the stored session '${name}' could not be opened (was the instance key changed?); the run starts signed out`,
      error
    )
    return undefined
  }
}

/**
 * Browser Session Repository Implementation (Drizzle).
 *
 * Seals on write, opens on read (`crypto/token-encrypt.ts`, AES-256-GCM under
 * the instance key): the `jar` column never holds a readable cookie. A save is
 * one INSERT … ON CONFLICT DO UPDATE on the session name.
 */
export const BrowserSessionRepositoryLive = Layer.succeed(BrowserSessionRepository, {
  load: (name) =>
    wrap(async () => {
      const rows = await db
        .select({ jar: browserSessions.jar })
        .from(browserSessions)
        .where(eq(browserSessions.name, name))
        .limit(1)
      const sealed = rows[0]?.jar
      return sealed === undefined ? undefined : openJar(name, sealed)
    }),

  save: (name, jar) =>
    wrap(async () => {
      const sealed = encryptToken(jar)
      await db
        .insert(browserSessions)
        .values({ name, jar: sealed, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: browserSessions.name,
          set: { jar: sealed, updatedAt: new Date() },
        })
    }),
})
