/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  DesignSystemShareDatabaseError,
  DesignSystemShareRepository,
  type DesignSystemShareRecord,
} from '@/application/ports/repositories/design-system/design-system-share-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { designSystemShares as designSystemSharesPg } from '@/infrastructure/database/drizzle/schema/design-system-shares'
import { designSystemShares as designSystemSharesSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/design-system-shares'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * Drizzle implementation of the design-system share port.
 *
 * The pg and sqlite table objects are resolved once at module init through
 * `resolveDialectSchema` — the PG variant emits `system.design_system_shares`,
 * the SQLite one the flat `system_design_system_shares`, and a repository
 * pinned to either would fail on the other engine. SQLite is Sovrium's
 * zero-config default, so pinning to PG is the failure this project has already
 * shipped once.
 */
const designSystemShares = resolveDialectSchema(designSystemSharesPg, designSystemSharesSqlite)

/** Wrap a DB promise, adapting failures to `DesignSystemShareDatabaseError`. */
const wrap = makeDbWrap((cause) => new DesignSystemShareDatabaseError({ cause }))

/**
 * Project a raw row onto the port's record shape.
 *
 * The digest is dropped HERE, at the boundary, rather than by each caller. A
 * row spread straight onto the wire is how a hash reaches a response, and the
 * cheapest place to make that impossible is the one function every read goes
 * through.
 */
const decodeRow = (row: Readonly<Record<string, unknown>>): DesignSystemShareRecord => {
  const { createdBy, revokedAt } = row
  return {
    id: String(row['id']),
    createdAt: row['createdAt'] as Date,
    ...(typeof createdBy === 'string' ? { createdBy } : {}),
    ...(revokedAt instanceof Date ? { revokedAt } : {}),
  }
}

export const DesignSystemShareRepositoryLive = Layer.succeed(DesignSystemShareRepository, {
  create: ({ appName, tokenHash, createdBy }) =>
    wrap(async () => {
      const [row] = await db
        .insert(designSystemShares)
        .values({ appName, tokenHash, ...(createdBy === undefined ? {} : { createdBy }) })
        .returning()
      return decodeRow((row ?? {}) as Record<string, unknown>)
    }),

  listActive: (appName: string) =>
    wrap(() =>
      db
        .select()
        .from(designSystemShares)
        .where(and(eq(designSystemShares.appName, appName), isNull(designSystemShares.revokedAt)))
        .orderBy(desc(designSystemShares.createdAt))
    ).pipe(Effect.map((rows) => rows.map((row) => decodeRow(row as Record<string, unknown>)))),

  findActiveByTokenHash: (appName: string, tokenHash: string) =>
    wrap(() =>
      db
        .select()
        .from(designSystemShares)
        .where(
          and(
            eq(designSystemShares.appName, appName),
            eq(designSystemShares.tokenHash, tokenHash),
            isNull(designSystemShares.revokedAt)
          )
        )
        .limit(1)
    ).pipe(
      Effect.map((rows) =>
        rows[0] === undefined ? undefined : decodeRow(rows[0] as Record<string, unknown>)
      )
    ),

  revoke: (appName: string, id: string) =>
    wrap(() =>
      db
        .update(designSystemShares)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(designSystemShares.appName, appName),
            eq(designSystemShares.id, id),
            // Only a LIVE row is revocable, so a repeat DELETE answers 404
            // rather than silently re-stamping a later timestamp over the
            // moment the link actually stopped working.
            isNull(designSystemShares.revokedAt)
          )
        )
        .returning()
    ).pipe(Effect.map((rows) => rows.length > 0)),
})
