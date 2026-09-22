/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * `system.design_system_shares` — the revocable public share links over the
 * design system ([internal ref] amendment A3 Part 2).
 *
 * One row is one mint. Its existence is what makes `GET /s/design-system/{token}`
 * resolve for an anonymous reader, and clearing `revoked_at IS NULL` is what
 * stops it. This is the `/l/{slug}` shape [internal ref] D1 authorised — a platform
 * route with a database lookup — so nothing about the configuration document
 * changes when an operator publishes or unpublishes.
 *
 * ─── THE PLAINTEXT IS NOT HERE, AND CANNOT BE ───────────────────────────────
 *
 * `token_hash` holds the SHA-256 hex digest of a 256-bit token, following the
 * pattern `src/application/use-cases/auth/bootstrap-token.ts` established: the
 * plaintext is generated in the use case, returned to the operator exactly
 * once, and never persisted or logged. There is deliberately NO `token`
 * column — a re-servable secret is not revocable in any meaningful sense,
 * because an operator who can re-read it never learns it was compromised.
 *
 * The uniqueness constraint therefore lives on the DIGEST, the only column that
 * exists at rest. (A `share-link-helpers.ts` under `src/domain/utils/` promised
 * a UNIQUE index on a plaintext `token` column; it was never used here, its
 * table was never created, and the layout programme removed it.)
 *
 * ─── REVOCATION IS A TIMESTAMP, NOT A DELETE ────────────────────────────────
 *
 * A3 permits either. A timestamp is chosen because the row is the only record
 * that a publication ever happened: hard-deleting it would erase the thing the
 * `design.share.revoked` audit entry points at, so an operator reconstructing
 * "what did we publish, and when did we stop?" would find an audit trail
 * referring to nothing.
 */
export const designSystemShares = systemSchema.table(
  'design_system_shares',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    appName: text('app_name').notNull().default('default'),

    /** SHA-256 hex digest of the plaintext. NEVER the plaintext itself. */
    tokenHash: text('token_hash').notNull(),

    /** The admin who minted it, for the audit trail's benefit. */
    createdBy: text('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Set on revoke. A row with a value here resolves to 404, like a miss. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('design_system_shares_token_hash_unique').on(table.tokenHash),
    index('design_system_shares_app_revoked_idx').on(table.appName, table.revokedAt),
  ]
)

export type DesignSystemShare = typeof designSystemShares.$inferSelect
export type NewDesignSystemShare = typeof designSystemShares.$inferInsert
