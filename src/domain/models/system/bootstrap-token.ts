/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bootstrap Token — One-Time First-Admin Claim
 *
 * When Sovrium is run with no `AUTH_ADMIN_EMAIL` env var AND no users
 * exist in `auth.user`, the server generates a one-time bootstrap token
 * at startup, prints the plaintext to stdout exactly once, and stores
 * the SHA-256 hash in `system.sovrium_bootstrap_tokens`.
 *
 * The token is exchanged via `POST /api/admin/bootstrap/claim` with a
 * `Bearer <token>` header + `{ email, password, name }` body. On success
 * the row is marked `usedAt = now()` and the route is unmounted (subsequent
 * requests return 404).
 *
 * The plaintext is never persisted. Hashing prevents the row in
 * `system.sovrium_bootstrap_tokens` from being a credential — leaking the
 * row does not let an attacker claim the bootstrap.
 */

import { Data, Schema } from 'effect'

// ---------------------------------------------------------------------------
// BootstrapToken (persisted record)
// ---------------------------------------------------------------------------

export const BootstrapTokenSchema = Schema.Struct({
  /** SHA-256 hex digest of the plaintext token. Primary key. */
  tokenHash: Schema.String.pipe(Schema.minLength(64), Schema.maxLength(64)),
  expiresAt: Schema.DateFromSelf,
  usedAt: Schema.optional(Schema.DateFromSelf),
  createdAt: Schema.DateFromSelf,
}).pipe(
  Schema.annotations({
    identifier: 'BootstrapToken',
    title: 'Bootstrap Token (persisted hash)',
    description: 'One-time bootstrap token persisted as SHA-256 hash. Plaintext is never stored.',
  })
)

export type BootstrapToken = typeof BootstrapTokenSchema.Type

// ---------------------------------------------------------------------------
// BootstrapTokenClaim (request payload)
// ---------------------------------------------------------------------------

export const BootstrapTokenClaimSchema = Schema.Struct({
  email: Schema.String.pipe(Schema.minLength(3)),
  password: Schema.String.pipe(Schema.minLength(8)),
  name: Schema.String.pipe(Schema.minLength(1)),
}).pipe(
  Schema.annotations({
    identifier: 'BootstrapTokenClaim',
    title: 'Bootstrap Token Claim Payload',
    description:
      'Body of POST /api/admin/bootstrap/claim. Bearer token is read from the Authorization header.',
  })
)

/** @public */
export type BootstrapTokenClaim = typeof BootstrapTokenClaimSchema.Type

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Raised when no row matches the hashed token. Maps to HTTP 401. */
export class BootstrapTokenNotFoundError extends Data.TaggedError('BootstrapTokenNotFoundError')<{
  readonly tokenHash: string
}> {}

/** Raised when the token row exists but `expiresAt` is in the past. Maps to HTTP 401. */
export class BootstrapTokenExpiredError extends Data.TaggedError('BootstrapTokenExpiredError')<{
  readonly expiresAt: Date
}> {}

/** Raised when the token row already has `usedAt` set. Maps to HTTP 401. */
export class BootstrapTokenAlreadyUsedError extends Data.TaggedError(
  'BootstrapTokenAlreadyUsedError'
)<{
  readonly usedAt: Date
}> {}

/**
 * Union of all bootstrap-token errors so use cases can declare a single
 * Effect error channel.
 */
export type BootstrapTokenError =
  | BootstrapTokenNotFoundError
  | BootstrapTokenExpiredError
  | BootstrapTokenAlreadyUsedError
