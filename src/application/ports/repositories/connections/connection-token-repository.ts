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
 * Defense-in-depth: raised by `upsertForUser` when running in
 * production and asked to persist a sentinel-shaped access token (one that
 * matches `isSentinelAccessToken` — see `infrastructure/connections/
 * sentinel-tokens.ts`). Sentinels exist only to satisfy the encryption-
 * at-rest test specs; the seeder no-ops on `NODE_ENV === 'production'`,
 * but that gate is fail-open if `NODE_ENV` is unset. This
 * repository-side rejection is the second line of defense.
 *
 * Callers should let this propagate — there is no recoverable state.
 */
export class SentinelTokenInProductionError extends Data.TaggedError(
  'SentinelTokenInProductionError'
)<{
  readonly connectionId: string
  /**
   * The user the rejected write was keyed to, or `undefined` for an
   * `app`-scoped (shared) write, which by construction has no user. Recording
   * `undefined` rather than a placeholder keeps the security log honest — a
   * synthetic id here would send an operator looking for an account that was
   * never involved.
   */
  readonly userId: string | undefined
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
 * Plaintext shape of an `app`-scoped connection's SHARED credential.
 *
 * Deliberately has no `userId`: the whole point of the shared store is that
 * the credential belongs to the installation, not to whoever happened to
 * click Connect. Backs `system.connection_app_tokens`.
 */
export interface ConnectionAppTokenPlaintext {
  readonly id: string
  readonly connectionId: string
  readonly accessToken: string
  readonly refreshToken: string | undefined
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Secret-free metadata for the shared app token — the app-scope counterpart
 * of {@link ConnectionUserSummary}, used by the admin connection list so a
 * shared credential counts toward `tokenCount` and contributes its expiry to
 * the connection's health badge. Never carries token plaintext, and reading
 * it never decrypts (so a key-mismatched install still renders its dashboard
 * instead of 500ing).
 */
export interface ConnectionAppTokenSummary {
  readonly expiresAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Token-row metadata for admin listing. Exposes per-user state without
 * the access/refresh-token plaintext — admins seeing which users have
 * connected MUST NOT receive the token values, per
 * [internal ref].
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
 * Spec contract: spec `[internal ref]` asserts that the
 * raw access_token column is encrypted at rest. Tests can use
 * `decryptToken` from `[internal ref]` to round-trip
 * back to plaintext for content assertions, OR assert that the raw
 * column does not contain the plaintext substring.
 */
export class ConnectionTokenRepository extends Context.Service<
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
    /**
     * Delete EVERY token row keyed to `connectionId` (across all users).
     *
     * Used by the admin disconnect action on an `app`-scoped
     * (engineer-managed, shared) connection: disconnecting must return the
     * connection to the unconnected state (`tokenCount === 0`), which means
     * clearing every operator's token row, not just the caller's. Returns the
     * number of rows deleted.
     */
    readonly deleteForConnection: (
      connectionId: string
    ) => Effect.Effect<number, ConnectionTokenDatabaseError>
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

    // ── `app`-scoped (shared) credential — system.connection_app_tokens ──────
    //
    // Extends THIS port rather than introducing a second one: the refresh path
    // re-provides `ConnectionTokenRepositoryLive` dynamically inside
    // `withRefreshLock` (see auth-headers.ts), and a separate port would have
    // to be merged in at three separate composition sites for no gain.

    /** The shared credential for a connection, decrypted, or undefined. */
    readonly findForApp: (input: {
      readonly connectionId: string
    }) => Effect.Effect<ConnectionAppTokenPlaintext | undefined, ConnectionTokenDatabaseError>

    /**
     * Write the shared credential, replacing any existing one. Atomic against
     * the `(connection_id)` unique index, so two operators completing consent
     * concurrently resolve to exactly one row.
     */
    readonly upsertForApp: (input: {
      readonly connectionId: string
      readonly accessToken: string
      readonly refreshToken?: string
      readonly expiresAt?: Date
    }) => Effect.Effect<
      ConnectionAppTokenPlaintext,
      ConnectionTokenDatabaseError | SentinelTokenInProductionError
    >

    /** Drop the shared credential. `true` when a row was actually removed. */
    readonly deleteForApp: (input: {
      readonly connectionId: string
    }) => Effect.Effect<boolean, ConnectionTokenDatabaseError>

    /** Secret-free metadata for the shared credential, without decrypting. */
    readonly findAppSummary: (input: {
      readonly connectionId: string
    }) => Effect.Effect<ConnectionAppTokenSummary | undefined, ConnectionTokenDatabaseError>

    /**
     * Upgrade path: adopt a PRE-UPGRADE, user-keyed credential as this
     * connection's shared one.
     *
     * An installation that authorized an `app`-scoped connection before the
     * shared store existed has its credential filed under the `user_id` of
     * whoever clicked Connect. Post-upgrade the dashboard still sees that row
     * and renders "connected" while the runtime reads an empty shared store
     * and every unattended automation fails — a disagreement nothing in the UI
     * reports. A SQL migration cannot repair it, because `scope` lives in app
     * config and not in the database, so a migration cannot tell an app-scoped
     * connection's rows from genuine per-user ones it must not touch.
     *
     * Copies the most-recently-updated row's ciphertext VERBATIM — never
     * decrypt-then-re-encrypt — so the adoption is byte-preserving and works
     * even on an install whose encryption key no longer matches.
     *
     * Idempotent and non-destructive: no-op when a shared row already exists
     * or when there is nothing to adopt, and the source row is left in place.
     * Returns `true` only when a row was actually adopted.
     */
    readonly adoptLegacyUserTokenAsApp: (input: {
      readonly connectionId: string
    }) => Effect.Effect<boolean, ConnectionTokenDatabaseError>
  }
>()('ConnectionTokenRepository') {}
