/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * system.sovrium_bootstrap_tokens — sqlite-core mirror of
 * `schema/bootstrap-tokens.ts`.
 *
 * Auth infrastructure (NOT config editing): the one-time first-admin claim
 * token (`POST /api/admin/bootstrap/claim`). Plaintext is NEVER stored — the
 * `tokenHash` column holds the SHA-256 hex digest of the plaintext printed to
 * stdout once at boot.
 *
 * Infrastructure-only — NOT exposed through the user-facing MCP table
 * enumeration in `domain/models/shared/internal-tables.ts`.
 */
export const sovriumBootstrapTokens = systemTable('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})
