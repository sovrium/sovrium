/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the **App Connections** admin read endpoint family
 * (`GET /api/admin/connections` + `.../:id`) — the last data page of the pure
 * operational admin DATA console (`/_admin/data/connections`).
 *
 * The application layer owns ALL projection + derivation logic:
 *   - reading `system.connections` rows + the per-connection secret-free token
 *     summary (`ConnectionUserSummary[]`) from `system.connection_tokens`,
 *   - projecting each connection to the HARD ALLOW-LIST (`id`, `name`,
 *     `provider`, `type`, `tokenCount`, soonest `expiresAt`, derived `status`,
 *     `createdAt`) — NEVER `credentials` / `accessToken` / `refreshToken` (S4),
 *   - deriving the connection-level + per-user `status` via the pure domain
 *     `deriveConnectionStatus` helper,
 *   - assembling + response-schema-validating both bodies against the
 *     `.strict()` Zod allow-list (a stray secret key fails the parse).
 *
 * Only the raw `connections` / `connection_tokens` reads live in the
 * infrastructure repositories, reused via {@link ConnectionRepository} +
 * {@link ConnectionTokenRepository} (their `list` / `findById` /
 * `listUsersForConnection` methods already return secret-free shapes). The audit
 * emits (`connection.{list|detail}.queried`) stay in the route after a
 * successful read.
 */

import { Effect, Layer } from 'effect'
import {
  type ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connections/connection-repository'
import {
  type ConnectionAppTokenSummary,
  type ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
  type ConnectionUserSummary,
} from '@/application/ports/repositories/connections/connection-token-repository'
import {
  connectionsListResponseSchema,
  connectionDetailResponseSchema,
  type ConnectionListItem,
  type ConnectionUserToken,
} from '@/domain/models/api/admin/connections/connections'
import {
  deriveConnectionRowAction,
  deriveConnectionStatus,
  soonestExpiryMs,
} from '@/domain/services/admin/connection-status'
import { OAuthStateStoreLive } from '@/infrastructure/connections/oauth-state-store-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'

/* eslint-disable unicorn/no-null -- the API envelope canonically uses `null` for an absent connection-level `expiresAt` (no token rows OR no recorded expiry) and for a per-user token with no recorded expiry, matching the nullable Zod response contract */

// ─── Pure coercion + projection helpers ──────────────────────────────────────

/** Coerce a dialect-native timestamp to an ISO 8601 string. */
function toIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

/** Coerce a dialect-native nullable expiry to an ISO 8601 string, or `null`. */
function expiryToIso(raw: Readonly<Date> | string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  return toIso(raw)
}

/**
 * Project a raw `system.connections` row + its token summary to the canonical
 * HARD ALLOW-LIST list item. Reads ONLY the allow-listed columns by name — the
 * raw row is NEVER spread, so `credentials` (NOT NULL on the table) cannot ride
 * along (S4). `tokenCount` is the summary length; the connection-level
 * `expiresAt` is the soonest token expiry (null when no tokens / no expiry); the
 * `status` derives from that soonest expiry.
 */
function buildConnectionItem(
  row: Readonly<Record<string, unknown>>,
  tokens: readonly ConnectionUserSummary[],
  appToken: Readonly<ConnectionAppTokenSummary> | undefined
  // eslint-disable-next-line functional/prefer-immutable-types -- Zod-inferred response shape (upstream-mutable); the route serializes it straight to JSON without mutating
): ConnectionListItem {
  // The count is the UNION of the two stores, derived from which rows actually
  // exist rather than from the connection's declared `scope`. That matters:
  // these rows are read from `system.connections`, which is also populated by
  // paths that have no `app.connections[]` entry at all, so a scope-driven
  // count would report every such connection as unconnected. "One shared
  // credential counts as one."
  const soonestMs = soonestExpiryMs([
    ...tokens.map((t) => t.expiresAt),
    ...(appToken === undefined ? [] : [appToken.expiresAt]),
  ])
  const type = String(row['type'])
  const status = deriveConnectionStatus(soonestMs)
  const tokenCount = tokens.length + (appToken === undefined ? 0 : 1)
  return {
    id: String(row['id']),
    name: String(row['name']),
    provider: String(row['provider']),
    type,
    tokenCount,
    expiresAt: soonestMs === null ? null : new Date(soonestMs).toISOString(),
    status,
    // Server-computed display hint so the dashboard data-table can gate its
    // connect/reconnect/disconnect buttons with a single-field `visibleWhen`
    // (the compound rule — type + tokenCount + status — stays here, not config).
    rowAction: deriveConnectionRowAction(type, tokenCount, status),
    createdAt: toIso(row['createdAt'] as Date | string),
  }
}

/**
 * Project a secret-free token summary to the canonical per-user token row —
 * EXACTLY the three allow-listed keys (`userId`, `expiresAt`, `status`). The
 * summary already excludes the access/refresh-token plaintext (S4).
 */
function buildUserToken(
  summary: Readonly<ConnectionUserSummary>
  // eslint-disable-next-line functional/prefer-immutable-types -- Zod-inferred response shape (upstream-mutable)
): ConnectionUserToken {
  return {
    userId: summary.userId,
    expiresAt: expiryToIso(summary.expiresAt),
    status: deriveConnectionStatus(summary.expiresAt),
  }
}

// ─── List use case ────────────────────────────────────────────────────────────

/**
 * Outcome of the connection-list build. `Ok` carries the response-schema-
 * validated body; `ValidationFailed` signals the assembled body failed the
 * `.strict()` response gate (the route maps this to a 500 + logs the Zod error —
 * a stray secret field would fail the parse rather than leak).
 */
export type ConnectionsListOutcome =
  | { readonly _tag: 'Ok'; readonly body: { readonly connections: readonly ConnectionListItem[] } }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the connection-list body. Reads every `system.connections` row, then
 * the per-connection token summary, projects to the allow-list, and validates
 * against the `.strict()` list schema.
 */
export const BuildConnectionsList: Effect.Effect<
  ConnectionsListOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> = Effect.gen(function* () {
  const connRepo = yield* ConnectionRepository
  const tokenRepo = yield* ConnectionTokenRepository

  const rows = yield* connRepo.list

  const connections = yield* Effect.all(
    rows.map((row) =>
      Effect.gen(function* () {
        const connectionId = String(row['id'])
        const tokens = yield* tokenRepo.listUsersForConnection({ connectionId })
        const appToken = yield* tokenRepo.findAppSummary({ connectionId })
        return buildConnectionItem(row, tokens, appToken)
      })
    )
  )

  const body = { connections }
  const parsed = connectionsListResponseSchema.safeParse(body)
  if (!parsed.success) {
    return { _tag: 'ValidationFailed', error: parsed.error } as const
  }
  return { _tag: 'Ok', body: { connections: parsed.data.connections } }
})

// ─── Detail use case ──────────────────────────────────────────────────────────

/**
 * Outcome of the connection-detail build. `Ok` carries the response-schema-
 * validated body; `NotFound` signals an unknown connection id (the route maps
 * this to the anti-enum 404); `ValidationFailed` signals the assembled body
 * failed the response gate (route → 500).
 */
export type ConnectionDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly connection: ConnectionListItem
        readonly tokens: readonly ConnectionUserToken[]
      }
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the connection-detail body for a single connection id. A miss
 * (`findById` returns undefined — unknown id) resolves to `NotFound`. On a hit,
 * the per-user token roster is loaded (secret-free) and shaped into the
 * connection header + token rows.
 */
export const BuildConnectionDetail = (
  id: string
): Effect.Effect<
  ConnectionDetailOutcome,
  ConnectionDatabaseError | ConnectionTokenDatabaseError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    const row = yield* connRepo.findById(id)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const connectionId = String(row['id'])
    const summaries = yield* tokenRepo.listUsersForConnection({ connectionId })
    const appToken = yield* tokenRepo.findAppSummary({ connectionId })
    const body = {
      // The `tokens` roster stays per-user only: the shared credential has no
      // user, and inventing one would put a userId in the roster that names
      // nobody. It still contributes to the header's `tokenCount`/`status`.
      connection: buildConnectionItem(row, summaries, appToken),
      tokens: summaries.map((summary) => buildUserToken(summary)),
    }

    const parsed = connectionDetailResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { connection: parsed.data.connection, tokens: parsed.data.tokens } }
  })

/* eslint-enable unicorn/no-null */

/**
 * Application layer for the admin connections use cases — bundles the connection
 * + connection-token repository Live layers AND the OAuth state store so the
 * route's effect-runner composition root provides a single layer. The state
 * store backs the admin OAuth action routes' authorize→callback hop
 * (`connections-actions.ts`), alongside the read endpoints' repositories.
 */
export const AdminConnectionsLayer = Layer.mergeAll(
  ConnectionRepositoryLive,
  ConnectionTokenRepositoryLive,
  OAuthStateStoreLive
)
