/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bootstrap Token Use Cases
 *
 * Two flows:
 *
 *   1. `generateBootstrapTokenIfNeeded` — runs at server boot. If
 *      Sovrium is in "no-config" mode (no users, no AUTH_ADMIN_EMAIL),
 *      generates a 256-bit cryptographically random plaintext token,
 *      hashes it, persists the hash to `system.sovrium_bootstrap_tokens`,
 *      and returns the plaintext for ONE-TIME printing to stdout.
 *
 *   2. `claimBootstrapToken` — handles the
 *      `POST /api/admin/bootstrap/claim` request. Validates the bearer
 *      token against the persisted hash, creates the first admin user
 *      via Better Auth, and atomically marks the token as consumed.
 *
 * Hashing strategy: SHA-256 over the UTF-8 plaintext, hex-encoded.
 * `bun.password` would be overkill here — the token is high-entropy
 * by construction (256 bits) so a fast hash provides "leak-tolerant"
 * storage without the work-factor cost.
 *
 * Token format: hex-encoded 32-byte (64 hex chars) random string. This
 * is exactly the same shape used elsewhere in Sovrium for short-lived
 * one-time secrets and matches what spec fixtures already use.
 */

import { createHash, randomBytes } from 'node:crypto'
import { Data, Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth-repository'
import { BootstrapTokenRepository } from '@/application/ports/repositories/bootstrap-token-repository'
import { Auth } from '@/infrastructure/auth/better-auth'
import type { BootstrapTokenDatabaseError } from '@/application/ports/repositories/bootstrap-token-repository'
import type { BootstrapTokenError } from '@/domain/models/system'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Token TTL: 1 hour from generation. */
export const BOOTSTRAP_TOKEN_TTL_MS = 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BootstrapAdminCreationError extends Data.TaggedError('BootstrapAdminCreationError')<{
  readonly cause: unknown
}> {}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** SHA-256 hex digest of a UTF-8 plaintext string. */
export const hashBootstrapToken = (plaintext: string): string =>
  createHash('sha256').update(plaintext, 'utf8').digest('hex')

/** Generate a fresh 256-bit (64 hex char) cryptographically random token. */
export const generatePlaintextToken = (): string => randomBytes(32).toString('hex')

// ---------------------------------------------------------------------------
// Use case: generateBootstrapTokenIfNeeded
// ---------------------------------------------------------------------------

/**
 * Decision input for "should we generate a token at boot?". Kept as a
 * parameter rather than reading `process.env` inside the use case so
 * tests can drive every branch without monkey-patching env vars.
 */
export interface BootstrapTokenBootContext {
  /** Set when AUTH_ADMIN_EMAIL is present in env (env-var bootstrap path is in play). */
  readonly hasAuthAdminEmailEnv: boolean
  /** True when `auth.user` is empty (no users have ever been created). */
  readonly userTableIsEmpty: boolean
}

/**
 * Result of the generate-if-needed flow:
 *
 *   - `kind: 'generated'`  → plaintext token; the caller should print it
 *   - `kind: 'skipped'`    → no token needed (env-var bootstrap or users
 *                             already exist)
 */
export type GenerateBootstrapTokenResult =
  | { readonly kind: 'generated'; readonly plaintext: string; readonly expiresAt: Date }
  | { readonly kind: 'skipped'; readonly reason: 'env-var-bootstrap' | 'users-exist' }

/**
 * Generate a one-time bootstrap token IFF the operator started Sovrium
 * with no admin credentials AND no users exist. Persists the hash and
 * returns the plaintext exactly once — the caller is responsible for
 * printing it (typically the server startup banner).
 *
 * The plaintext is NEVER logged anywhere; the use case returns it
 * directly to the caller and the caller is the only entity that ever
 * sees it.
 */
export const generateBootstrapTokenIfNeeded = (
  context: BootstrapTokenBootContext,
  now: Date = new Date()
): Effect.Effect<
  GenerateBootstrapTokenResult,
  BootstrapTokenDatabaseError,
  BootstrapTokenRepository
> =>
  Effect.gen(function* () {
    if (context.hasAuthAdminEmailEnv) {
      return { kind: 'skipped', reason: 'env-var-bootstrap' } as const
    }
    if (!context.userTableIsEmpty) {
      return { kind: 'skipped', reason: 'users-exist' } as const
    }

    const plaintext = generatePlaintextToken()
    const tokenHash = hashBootstrapToken(plaintext)
    const expiresAt = new Date(now.getTime() + BOOTSTRAP_TOKEN_TTL_MS)

    const repo = yield* BootstrapTokenRepository
    yield* repo.create({ tokenHash, expiresAt })

    return { kind: 'generated', plaintext, expiresAt } as const
  })

// ---------------------------------------------------------------------------
// Use case: claimBootstrapToken
// ---------------------------------------------------------------------------

/**
 * Input to the claim flow. The plaintext token is read from the
 * `Authorization: Bearer <token>` header upstream and passed in here.
 */
export interface BootstrapTokenClaimInput {
  readonly token: string
  readonly email: string
  readonly password: string
  readonly name: string
}

/** Output of a successful claim: the freshly-created admin user's id. */
export interface BootstrapTokenClaimOutput {
  readonly userId: string
  readonly email: string
}

/**
 * Atomically consume a bootstrap token and provision the first admin
 * user via Better Auth's createUser API. The order is:
 *
 *   1. Hash the bearer token + claim it via the repository
 *      (atomic UPDATE — concurrent claim attempts can't both win).
 *   2. Call `auth.api.createUser({ role: 'admin' })`.
 *
 * If user creation fails AFTER the token was claimed, the token is
 * already marked used — that's acceptable because the operator can
 * always re-run the server with `AUTH_ADMIN_EMAIL` set to recover.
 * Reverting the claim would require a transactional flow across two
 * different storage systems (DB + Better Auth's own writes), which is
 * out of scope for Phase 1.
 */
export const claimBootstrapToken = (
  input: BootstrapTokenClaimInput
): Effect.Effect<
  BootstrapTokenClaimOutput,
  | BootstrapTokenDatabaseError
  | BootstrapTokenError
  | BootstrapAdminCreationError
  | AuthDatabaseError,
  BootstrapTokenRepository | Auth | AuthRepository
> =>
  Effect.gen(function* () {
    const tokenHash = hashBootstrapToken(input.token)

    const repo = yield* BootstrapTokenRepository
    yield* repo.claim(tokenHash)

    const auth = yield* Auth

    const created = yield* Effect.tryPromise({
      try: () =>
        auth.api.createUser({
          body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: 'admin',
          },
        }),
      catch: (cause) => new BootstrapAdminCreationError({ cause }),
    })

    const userId = (created as { user?: { id?: string } } | undefined)?.user?.id
    if (typeof userId !== 'string' || userId.length === 0) {
      return yield* new BootstrapAdminCreationError({
        cause: new Error('Better Auth createUser returned no user id'),
      })
    }

    // Mark the new user's email as verified — they had to demonstrate
    // possession of the bootstrap token, so the verification email
    // round-trip would just be friction.
    const authRepo = yield* AuthRepository
    yield* authRepo.verifyUserEmail(userId)

    return { userId, email: input.email }
  })
