/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * system.sovrium_bootstrap_tokens — one-time first-admin claim
 *
 * Auth infrastructure (NOT config editing): when Sovrium launches without an
 * `app.auth` admin and no `AUTH_ADMIN_EMAIL`, a one-time bootstrap token is
 * minted and printed to stdout so the first operator can claim the admin role
 * via `POST /api/admin/bootstrap/claim`.
 *
 * Plaintext is NEVER stored. The `tokenHash` column holds the SHA-256 hex
 * digest (64 chars) of the plaintext token printed to stdout once at boot.
 *
 * Lives in `pgSchema('system')` — infrastructure-only, NOT exposed through the
 * user-facing MCP table enumeration in `domain/models/shared/internal-tables.ts`.
 */
export const sovriumBootstrapTokens = systemSchema.table('sovrium_bootstrap_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferSelect
export type NewSovriumBootstrapTokenRow = typeof sovriumBootstrapTokens.$inferInsert
