/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Writing, reading and dropping the credential a connection holds.
 *
 * Every program here branches on the connection's SCOPE, and the branch is the
 * design rather than a convenience:
 *
 *  - an `app`-scoped connection has ONE shared credential. It is written to the
 *    shared row and deliberately to no per-user row: `connection_tokens.user_id`
 *    is `ON DELETE cascade`, so a company-wide credential parked under one
 *    operator's row disappears the day that operator is offboarded — weeks
 *    later, with nothing connecting the two events. Disconnecting it drops the
 *    shared row, because deleting a per-user row that was never written would
 *    be a no-op reported as success.
 *  - a `user`-scoped connection has one credential per user, and both the write
 *    and the delete are keyed to the caller.
 *
 * Which callers may reach the `app` branch at all is a gate the HTTP layer
 * applies before any of this runs (admin-tier only, answering 404 to everyone
 * else); these programs assume that decision has already been made.
 */

import { Effect } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import { effectiveScope } from './connection-definition'
import { ConnectionStoreError } from './errors'
import type { ConnectionDef } from './connection-definition'

/** The credential a completed authorization produced. */
export interface IssuedCredential {
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
}

/** What the status endpoint reports about one (connection, user) pair. */
export interface ConnectionStatus {
  readonly connected: boolean
  readonly expiresAt: Date | undefined
}

/**
 * Lazy upsert: ensure a `system.connections` row exists for this connection
 * name, and answer with its id.
 *
 * Atomic via `upsertByName` (INSERT ... ON CONFLICT DO UPDATE on the
 * `connections_name_unique` index), so two concurrent first-authorize requests
 * for the same name both succeed and resolve to the same row (audit H3).
 *
 * `credentials: {}` — the full OAuth props including `clientSecret` live in the
 * in-memory `app.connections[]` config and are read at callback time. Persisting
 * them as plaintext JSONB would duplicate the secret to disk for no read-path
 * benefit (audit H2); the column stays populated with `{}` to honour NOT NULL.
 */
const resolveConnectionId = (
  conn: Readonly<ConnectionDef>
): Effect.Effect<string, ConnectionStoreError, ConnectionRepository> =>
  Effect.gen(function* () {
    const repo = yield* ConnectionRepository
    const row = yield* repo
      .upsertByName({
        name: conn.name,
        provider: String(conn.props['provider'] ?? conn.name),
        type: conn.type,
        credentials: {},
      })
      .pipe(
        Effect.mapError((cause) => new ConnectionStoreError({ operation: 'upsertByName', cause }))
      )
    return String(row['id'] ?? '')
  })

/** Persist a freshly-exchanged credential into the store its scope dictates. */
export const persistConnectionToken = (input: {
  readonly conn: ConnectionDef
  readonly scope: 'app' | 'user'
  readonly userId: string
  readonly credential: IssuedCredential
}): Effect.Effect<string, ConnectionStoreError, ConnectionRepository | ConnectionTokenRepository> =>
  Effect.gen(function* () {
    // `resolveConnectionId` already fails with ConnectionStoreError; no remap.
    const connectionId = yield* resolveConnectionId(input.conn)
    const tokenRepo = yield* ConnectionTokenRepository
    const common = {
      connectionId,
      accessToken: input.credential.accessToken,
      ...(input.credential.refreshToken === undefined
        ? {}
        : { refreshToken: input.credential.refreshToken }),
      ...(input.credential.expiresAt === undefined
        ? {}
        : { expiresAt: input.credential.expiresAt }),
    }
    const write =
      input.scope === 'app'
        ? tokenRepo.upsertForApp(common)
        : tokenRepo.upsertForUser({ ...common, userId: input.userId })
    yield* write.pipe(
      Effect.mapError((cause) => new ConnectionStoreError({ operation: 'persistToken', cause }))
    )
    return connectionId
  }).pipe(Effect.withSpan('connections.persist-token'))

/**
 * The (connection, token) state for one user.
 *
 * A stored token that is the test-mode seeder's SENTINEL reports as not
 * connected. Without that gate, a user created against a `scope: 'user'`
 * connection would always observe `connected`, because the seeder upserts a
 * 1h-TTL sentinel row at user-create time — and `[internal ref]`
 * / `-077` exist precisely to test the "has NOT yet authorized" state.
 */
export const readConnectionStatus = (input: {
  readonly name: string
  readonly userId: string
}): Effect.Effect<
  ConnectionStatus,
  ConnectionStoreError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(input.name)
      .pipe(
        Effect.mapError((cause) => new ConnectionStoreError({ operation: 'findByName', cause }))
      )
    if (row === undefined) {
      return { connected: false, expiresAt: undefined }
    }
    const tokenRepo = yield* ConnectionTokenRepository
    const token = yield* tokenRepo
      .findForUser({ connectionId: String(row['id']), userId: input.userId })
      .pipe(
        Effect.mapError((cause) => new ConnectionStoreError({ operation: 'findForUser', cause }))
      )
    if (token === undefined || isSentinelAccessToken(token.accessToken)) {
      return { connected: false, expiresAt: undefined }
    }
    return { connected: true, expiresAt: token.expiresAt }
  }).pipe(Effect.withSpan('connections.read-status'))

/**
 * Map a status onto the textual state the API reports.
 *
 * `expired` means a token row exists but its `expiresAt` has passed — the
 * automation runtime treats that as an opportunity to refresh rather than as a
 * disconnection, which is why it is a third value and not just `disconnected`.
 */
export const deriveConnectionState = (
  status: Readonly<ConnectionStatus>
): 'connected' | 'disconnected' | 'expired' => {
  if (!status.connected) return 'disconnected'
  if (status.expiresAt !== undefined && status.expiresAt.getTime() < Date.now()) return 'expired'
  return 'connected'
}

/**
 * Drop the credential a connection holds for this caller.
 *
 * Answers whether a row was actually deleted, so an idempotent repeat is
 * distinguishable from a first disconnect. `false` is also the answer when the
 * connection has no row at all.
 */
export const disconnectConnection = (input: {
  readonly conn: ConnectionDef
  readonly isOAuth2: boolean
  readonly userId: string
}): Effect.Effect<
  boolean,
  ConnectionStoreError,
  ConnectionRepository | ConnectionTokenRepository
> =>
  Effect.gen(function* () {
    const connRepo = yield* ConnectionRepository
    const row = yield* connRepo
      .findByName(input.conn.name)
      .pipe(
        Effect.mapError((cause) => new ConnectionStoreError({ operation: 'findByName', cause }))
      )
    if (row === undefined) return false
    const tokenRepo = yield* ConnectionTokenRepository
    const connectionId = String(row['id'])
    const isSharedCredential =
      input.isOAuth2 &&
      effectiveScope(input.conn.props as { readonly scope?: 'app' | 'user' }) === 'app'
    const drop = isSharedCredential
      ? tokenRepo.deleteForApp({ connectionId })
      : tokenRepo.deleteForUser({ connectionId, userId: input.userId })
    return yield* drop.pipe(
      Effect.mapError((cause) => new ConnectionStoreError({ operation: 'deleteToken', cause }))
    )
  }).pipe(Effect.withSpan('connections.disconnect'))
