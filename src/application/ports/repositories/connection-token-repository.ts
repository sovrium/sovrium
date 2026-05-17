/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for connection-token operations.
 */
export class ConnectionTokenDatabaseError extends Data.TaggedError('ConnectionTokenDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Defense-in-depth (REC-C4-4): raised by `upsertForUser` when running in
 * production and asked to persist a sentinel-shaped access token (one that
 * matches `isSentinelAccessToken` — see `infrastructure/connections/
 * sentinel-tokens.ts`). Sentinels exist only to satisfy the encryption-
 * at-rest test specs; the seeder no-ops on `NODE_ENV === 'production'`,
 * but that gate is fail-open if `NODE_ENV` is unset (REC-M-3). This
 * repository-side rejection is the second line of defense.
 *
 * Callers should let this propagate — there is no recoverable state.
 */
export class SentinelTokenInProductionError extends Data.TaggedError(
  'SentinelTokenInProductionError'
)<{
  readonly connectionId: string
  readonly userId: string
}> {}

/**
 * Plaintext token shape returned by reads. The repository decrypts
 * stored ciphertext at the boundary so callers above never see the
 * encrypted envelope — this keeps the encryption concern contained to
 * one layer.
 *
 * `expiresAt` is null for tokens that don't expire (long-lived API
 * keys); spec'd OAuth flows always set it.
 */
export interface ConnectionTokenPlaintext {
  readonly id: string
  readonly connectionId: string
  readonly userId: string
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Token-row metadata for admin listing. Exposes per-user state without
 * the access/refresh-token plaintext — admins seeing which users have
 * connected MUST NOT receive the token values, per
 * APP-AUTOMATION-CONNECTION-074.
 */
export interface ConnectionUserSummary {
  readonly userId: string
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Connection Token Repository Port.
 *
 * Backs `system.connection_tokens` — per-user OAuth tokens. The live
 * impl encrypts on write and decrypts on read using
 * `infrastructure/crypto/token-encrypt.ts`. Per-user isolation is
 * enforced at the (connection_id, user_id) tuple — the OAuth flow
 * upserts on this pair so a user re-authorizing the same connection
 * replaces their existing token row.
 *
 * Spec contract: spec `APP-AUTOMATION-CONNECTION-025` asserts that the
 * raw access_token column is encrypted at rest. Tests can use
 * `decryptToken` from `specs/fixtures/connections.ts` to round-trip
 * back to plaintext for content assertions, OR assert that the raw
 * column does not contain the plaintext substring.
 */
export class ConnectionTokenRepository extends Context.Tag('ConnectionTokenRepository')<
  ConnectionTokenRepository,
  {
    readonly findForUser: (input: {
      readonly connectionId: string
      readonly userId: string
    }) => Effect.Effect<ConnectionTokenPlaintext | undefined, ConnectionTokenDatabaseError>
    readonly upsertForUser: (input: {
      readonly connectionId: string
      readonly userId: string
      readonly accessToken: string
      readonly refreshToken?: string
      readonly expiresAt?: Date
    }) => Effect.Effect<
      ConnectionTokenPlaintext,
      ConnectionTokenDatabaseError | SentinelTokenInProductionError
    >
    readonly deleteForUser: (input: {
      readonly connectionId: string
      readonly userId: string
    }) => Effect.Effect<boolean, ConnectionTokenDatabaseError>
    readonly countForConnection: (
      connectionId: string
    ) => Effect.Effect<number, ConnectionTokenDatabaseError>
    /**
     * Return per-user metadata (no token plaintext) for every row keyed
     * to `connectionId`. The access-token plaintext is decrypted only
     * to evaluate the test-seeder sentinel filter (callers are expected
     * to drop sentinel rows so admins don't see "fake" connected users)
     * — the decrypted value never leaves this method.
     */
    readonly listUsersForConnection: (input: {
      readonly connectionId: string
    }) => Effect.Effect<readonly ConnectionUserSummary[], ConnectionTokenDatabaseError>
  }
>() {}
