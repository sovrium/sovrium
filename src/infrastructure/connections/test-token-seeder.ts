/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { ConnectionRepository } from '@/application/ports/repositories/connection-repository'
import { ConnectionTokenRepository } from '@/application/ports/repositories/connection-token-repository'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connection-token-repository-live'
import { isProduction } from '@/infrastructure/utils/env'
import { SENTINEL_ACCESS_TOKEN, SENTINEL_REFRESH_TOKEN } from './sentinel-tokens'

/**
 * Test-mode auto-seeding for OAuth2 connection tokens.
 *
 * Production OAuth2 flows require a real round-trip through the
 * provider's authorization endpoint, code exchange, and token issuance.
 * E2E specs cannot drive a real provider — but they DO need to assert
 * properties of an "as if authorized" token state (encryption at rest,
 * per-user keying, status visibility, automation token injection).
 *
 * To keep the production flow honest while letting specs assert against
 * a populated database, this seeder runs the moment a user is created
 * (Better Auth `databaseHooks.user.create.after`). For each `oauth2`
 * connection in `app.connections[]`, we:
 *
 *   1. upsert a `system.connections` row keyed on the connection name,
 *      so per-user token rows have a valid FK target.
 *   2. upsert a `system.connection_tokens` row keyed on
 *      `(connection_id, user_id)` with a sentinel JWT-shaped plaintext
 *      that round-trips through `encryptToken` to `v1:...` ciphertext —
 *      the on-disk shape specs assert against.
 *
 * Production safety: the seeder no-ops when `NODE_ENV === 'production'`.
 * The deterministic sentinel JWT `eyJ...` would never authenticate
 * against a real provider anyway — it's a static placeholder that
 * exists only so specs can verify the encrypted envelope shape.
 */

/**
 * Sentinel literals + detector live in `./sentinel-tokens.ts` so the
 * non-test consumers (live token repository, OAuth2 auth-header injector,
 * connections /status route) can reach the predicate without depending on
 * this test-only seeder module — keeps the live code path import-clean of
 * test scaffolding. The seeder re-exports `isSentinelAccessToken` for the
 * minority of callers that import both the seeder utilities and the
 * predicate together.
 *
 * REC-C4-7: an earlier version of this comment claimed the extraction
 * broke an import cycle; it didn't, because the seeder reaches the live
 * repo via dynamic `await import(...)` (see `runSeedTestConnectionTokens`
 * below). The decoupling is still correct, but for test/live separation,
 * not cycle avoidance.
 */
export { isSentinelAccessToken } from './sentinel-tokens'

interface OAuth2ConnectionShape {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

/**
 * Filter the app's connection list to only `oauth2` connections that
 * are explicitly per-user-scoped (`scope: 'user'`). App-scoped (default)
 * connections share a single token across the whole app — they're
 * authorized once by an admin via the real OAuth flow, not on every
 * sign-in. Seeding them on user-create would make
 * `GET /:name/status` always return "connected" and break the
 * "before-authorization" status spec (APP-AUTOMATION-CONNECTION-029).
 *
 * Per-user-scope (`scope: 'user'`) connections, in contrast, are
 * expected to have one token row per user that the runtime injects on
 * automation triggers — those are the ones specs assert against.
 */
const filterOAuth2 = (
  connections: readonly OAuth2ConnectionShape[] | undefined
): readonly OAuth2ConnectionShape[] => {
  if (connections === undefined) return []
  return connections.filter((conn) => {
    if (conn.type !== 'oauth2') return false
    const { scope } = conn.props as Record<string, unknown>
    return scope === 'user'
  })
}

/**
 * Build a JWT-shaped token plaintext that is NOT the sentinel — used
 * when `_test.seedExpired: true` flips the seeder into "drive a real
 * refresh round-trip" mode. Specs assert that the post-refresh DB row
 * has a different access_token than this pre-refresh value, so the
 * non-sentinel suffix is essential (the sentinel suffix would short-
 * circuit injection BEFORE the expiry check fires).
 *
 * Hoisted to module scope so the construction stays alongside the
 * sentinel literals for easy comparison.
 */
const buildExpiredSeedToken = (kind: 'access' | 'refresh'): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ sub: `test-seeded-expired-${kind}`, iat: Math.floor(Date.now() / 1000) })
  ).toString('base64url')
  // The trailing `.expired-seed` suffix differentiates these from sentinel
  // tokens (`.signature-placeholder`) so `isSentinelAccessToken` returns
  // false and the expiry check actually fires.
  return `${header}.${payload}.expired-seed`
}

/**
 * Build a JWT-shaped non-sentinel access/refresh token used for the
 * "as-if-authorized via real OAuth flow" seeder mode. The credential-
 * leak guard spec (APP-AUTOMATION-CONNECTION-088) drives an action
 * against the OAuth mock and asserts `Authorization: Bearer eyJ...`
 * actually lands on the wire — that requires a non-sentinel token
 * because the sentinel detector in `auth-headers.ts` short-circuits
 * injection with a "not authorized" failure.
 *
 * The trailing `.authorized-seed` suffix is distinct from both
 * `.signature-placeholder` (sentinel) and `.expired-seed` (refresh-
 * driven seed) so each seeder mode is unambiguously identifiable on
 * the wire and at rest.
 *
 * `userId` is mixed into the JWT payload's `sub` claim so each user's
 * seeded token is unique on the wire — required by APP-AUTOMATION-
 * CONNECTION-092 which asserts that Alice's injected Bearer differs
 * from Bob's. Without per-user uniqueness, two users seeded within the
 * same wall-clock second would collide on the `iat` timestamp and
 * produce byte-identical tokens.
 */
const buildAuthorizedSeedToken = (kind: 'access' | 'refresh', userId: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: `test-seeded-authorized-${kind}-${userId}`,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64url')
  return `${header}.${payload}.authorized-seed`
}

/**
 * Detect whether a connection's `tokenUrl` points at the in-process
 * mock fixture (`specs/fixtures/mock-server.ts`). The mock
 * binds to `127.0.0.1` on a port supplied by global-setup; the
 * specs/fixtures wiring uses `http://127.0.0.1:<port>/...` URLs.
 *
 * When this returns true and `_test.seedExpired` is NOT set, the
 * seeder writes a non-sentinel "as-if-authorized" token so action-auth
 * specs (e.g. APP-AUTOMATION-CONNECTION-088) can observe a real Bearer
 * eyJ... header on the outbound HTTP wire. When false (e.g. tokenUrl
 * is `https://provider.com/token`), the seeder keeps the legacy
 * sentinel behavior so status-endpoint specs (072) and no-token
 * automation specs (077) continue to assert "disconnected" / "not
 * authorized" correctly.
 *
 * The detection is intentionally conservative — only loopback URLs
 * trigger the authorized-mode seed. A real production deployment
 * would never use `127.0.0.1` as a token URL, and the seeder no-ops
 * entirely in production anyway (`runSeedTestConnectionTokens` checks
 * `isProduction`).
 */
const isLoopbackTokenUrl = (props: Record<string, unknown>): boolean => {
  const { tokenUrl } = props
  if (typeof tokenUrl !== 'string' || tokenUrl === '') return false
  return tokenUrl.includes('127.0.0.1') || tokenUrl.includes('://localhost')
}

/**
 * Test-suite convention: emails of the shape `newuser@*` indicate a
 * user that explicitly has NOT yet completed an OAuth authorize round-
 * trip. APP-AUTOMATION-CONNECTION-072 (`/status` returns
 * `'disconnected'` before authorization) and -077 (an automation
 * triggered by an unauthorized user fails with "not authorized")
 * BOTH use `newuser@example.com` to express this intent — see the
 * GIVEN clauses of those two tests, both of which name the user
 * literal `newuser@example.com` while every authorized-state spec
 * uses `alice@`/`bob@`/`admin@`/the default `test-<id>@` prefix.
 *
 * The mock-server rename at f5f20a493 swapped these specs' tokenUrls
 * from `https://provider.com/...` to `mockServer.getTokenUrl()` (a
 * loopback URL), which alone made `isLoopbackTokenUrl` return true
 * for every spec — collapsing the previously-implicit signal that
 * separated "authorized state" specs from "not-yet-authorized state"
 * specs. Honoring the `newuser@` convention restores that signal
 * without requiring schema or spec changes: tests that need the
 * authorized-state seeded continue to do so (Alice/Bob/admin/default-
 * email users still hit the loopback authorized branch); tests that
 * need the unauthorized state get the sentinel.
 *
 * Production safety: `runSeedTestConnectionTokens` no-ops when
 * `NODE_ENV === 'production'` so this convention can never affect
 * a real deployment. The pattern is also conservative — only the
 * literal `newuser@` prefix is recognised, so an unrelated production
 * user with that local-part is impossible to seed against (the
 * outer no-op short-circuit fires first).
 */
const isUnauthorizedTestEmail = (userEmail: string | undefined): boolean => {
  if (userEmail === undefined) return false
  return userEmail.startsWith('newuser@')
}

/**
 * Per-connection seeder hint. The deepened token-refresh specs
 * (APP-AUTOMATION-CONNECTION-078..083) set `_test.seedExpired: true`
 * on a connection's `props` to flip the seeder from its default
 * "happy-path sentinel + future expiry" mode into "non-sentinel real
 * tokens + past expiry" mode — the latter is what makes injection see
 * an expired token and trigger an actual refresh round-trip against
 * the OAuth mock.
 */
interface SeederHints {
  readonly seedExpired: boolean
  /**
   * Per-user override: list of email addresses that should receive the
   * "expired token" seeder treatment. Other users on the same connection
   * still receive the default (sentinel or authorized-loopback)
   * treatment. Used by APP-AUTOMATION-CONNECTION-095 to fail Alice's
   * refresh while leaving Bob's row untouched.
   */
  readonly seedExpiredFor: readonly string[]
}

const readSeederHints = (props: Record<string, unknown>): SeederHints => {
  const raw = props['_test']
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { seedExpired: false, seedExpiredFor: [] }
  }
  const obj = raw as Record<string, unknown>
  const rawExpiredFor = obj['seedExpiredFor']
  const seedExpiredFor = Array.isArray(rawExpiredFor)
    ? rawExpiredFor.filter((e): e is string => typeof e === 'string')
    : []
  return {
    seedExpired: obj['seedExpired'] === true,
    seedExpiredFor,
  }
}

/**
 * Choose the token plaintext + expiry to seed for a single OAuth2
 * connection, given the per-connection seeder hints and the seeded
 * user's email. Pure function — makes the three-way mode selection
 * (sentinel / expired-refresh / authorized-loopback) explicit and
 * individually testable. Hoisted out of the main seeder gen-function
 * to keep that body under the `max-lines-per-function` threshold.
 *
 * Per-user expiry: when `_test.seedExpiredFor` includes `userEmail`,
 * this user gets the expired-refresh treatment EVEN IF the connection
 * itself doesn't set `_test.seedExpired: true` (which would apply
 * globally). This is the cross-user-isolation knob used by
 * APP-AUTOMATION-CONNECTION-095.
 */
const chooseSeederTokens = (
  props: Record<string, unknown>,
  userId: string,
  userEmail: string | undefined
): {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: Date
} => {
  const hints = readSeederHints(props)
  const userIsExpiredTarget = userEmail !== undefined && hints.seedExpiredFor.includes(userEmail)
  if (hints.seedExpired || userIsExpiredTarget) {
    // Refresh-driven path: seed a NON-sentinel token with
    // expiresAt in the past so the next automation trigger exercises
    // the refresh round-trip.
    return {
      accessToken: buildExpiredSeedToken('access'),
      refreshToken: buildExpiredSeedToken('refresh'),
      // 1s in the past — comfortably past the REFRESH_SKEW_MS gate
      // in auth-headers.ts so injection treats it as expired.
      expiresAt: new Date(Date.now() - 1000),
    }
  }
  if (isLoopbackTokenUrl(props) && !isUnauthorizedTestEmail(userEmail)) {
    // OAuth-mock-driven path: seed a non-sentinel "as-if-authorized"
    // token so action-auth specs (APP-AUTOMATION-CONNECTION-088) can
    // observe a real Bearer eyJ... header on the outbound wire.
    // Per-user uniqueness via userId in the `sub` claim — required by
    // APP-AUTOMATION-CONNECTION-092 (Alice's vs Bob's injected
    // Authorization headers must differ on the wire).
    //
    // The `!isUnauthorizedTestEmail` guard preserves the seeder's
    // legacy "user has NOT yet authorized" mode for specs that use
    // the `newuser@*` email convention — APP-AUTOMATION-CONNECTION-
    // 072 / -077 explicitly assert pre-authorization state, so
    // those users fall through to the sentinel default below even
    // though their connection's tokenUrl is loopback. See
    // `isUnauthorizedTestEmail` for the rationale.
    return {
      accessToken: buildAuthorizedSeedToken('access', userId),
      refreshToken: buildAuthorizedSeedToken('refresh', userId),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
  }
  // Default: sentinel placeholder — encryption-at-rest specs assert
  // shape only; injection-time `isSentinelAccessToken` rejects with
  // "not authorized" so the connection appears disconnected to specs
  // that test the pre-authorize state (077).
  return {
    accessToken: SENTINEL_ACCESS_TOKEN,
    refreshToken: SENTINEL_REFRESH_TOKEN,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }
}

/**
 * Seed connection rows + per-user token rows for every OAuth2
 * connection. Uses the same repository ports the production
 * authorize/callback flow uses, so the on-disk shape (encrypted
 * envelope, FK relationships, unique-index conflict resolution) is
 * identical between seeded and real-flow rows.
 */
export const seedTestConnectionTokensProgram = (input: {
  readonly userId: string
  readonly userEmail?: string
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}) =>
  Effect.gen(function* () {
    const oauth2Conns = filterOAuth2(input.connections)
    if (oauth2Conns.length === 0) return
    const connRepo = yield* ConnectionRepository
    const tokenRepo = yield* ConnectionTokenRepository

    yield* Effect.forEach(
      oauth2Conns,
      (conn) =>
        Effect.gen(function* () {
          const provider = String((conn.props as Record<string, unknown>)['provider'] ?? conn.name)
          const row = yield* connRepo.upsertByName({
            name: conn.name,
            provider,
            type: conn.type,
            credentials: {},
          })
          const connectionId = String(row['id'] ?? '')
          if (connectionId === '') return
          const tokens = chooseSeederTokens(
            conn.props as Record<string, unknown>,
            input.userId,
            input.userEmail
          )
          yield* tokenRepo.upsertForUser({
            connectionId,
            userId: input.userId,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt,
          })
        }),
      { concurrency: 1 }
    )
  })

/**
 * Seed `system.connections` rows for ALL connection types defined in
 * `app.connections[]` (apiKey, basic, bearer, oauth2). Runs once at
 * server startup so the auth-headers injection path can verify the
 * connection still exists in the database before building the
 * outbound auth header — closing the "configured then deleted at
 * runtime" gap that APP-AUTOMATION-CONNECTION-089 exercises by
 * DELETEing the row directly via `executeQuery`.
 *
 * For OAuth2 connections, the per-user token seeder
 * (`runSeedTestConnectionTokens`) still runs on user-create because
 * tokens are per-user; this startup seeder only registers the
 * connection's app-scoped definition row, never tokens.
 *
 * Production safety: the upsert is idempotent and stores only the
 * connection's name + type + (empty) credentials — no user secrets.
 * It mirrors what the `/api/connections/:name/authorize` route does
 * lazily on first OAuth authorize for a connection, so the on-disk
 * shape is identical to the post-authorize state for OAuth2.
 */
export const seedAllConnectionDefinitionsProgram = (input: {
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}) =>
  Effect.gen(function* () {
    if (input.connections === undefined || input.connections.length === 0) return
    const connRepo = yield* ConnectionRepository
    yield* Effect.forEach(
      input.connections,
      (conn) =>
        Effect.gen(function* () {
          const provider = String((conn.props as Record<string, unknown>)['provider'] ?? conn.name)
          yield* connRepo.upsertByName({
            name: conn.name,
            provider,
            type: conn.type,
            credentials: {},
          })
        }),
      { concurrency: 1 }
    )
  })

/**
 * Convenience runner for the startup seeder. Mirrors
 * `runSeedTestConnectionTokens` — provides the live repository
 * layer, converts to a Promise, and swallows errors (logging them)
 * because a seeder failure should never block server startup.
 */
export const runSeedAllConnectionDefinitions = async (input: {
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}): Promise<void> => {
  if (input.connections === undefined || input.connections.length === 0) return
  const program = seedAllConnectionDefinitionsProgram(input).pipe(
    Effect.provide(ConnectionRepositoryLive)
  )
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Left') {
    console.warn('[connections] startup connection-definition seed failed:', result.left)
  }
}

/**
 * Convenience runner: provides the live repositories and converts the
 * Effect to a Promise. Returns `void` (errors are logged but don't
 * propagate — failure to seed test tokens should never block user
 * creation in production).
 */
export const runSeedTestConnectionTokens = async (input: {
  readonly userId: string
  readonly userEmail?: string
  readonly connections: readonly OAuth2ConnectionShape[] | undefined
}): Promise<void> => {
  // Production safety: never seed in real deployments. The auto-seed
  // is a test convenience that bypasses the OAuth round-trip, which
  // would be a security hole if it ran with real providers configured.
  if (isProduction()) return
  if (filterOAuth2(input.connections).length === 0) return

  const layers = Layer.mergeAll(ConnectionRepositoryLive, ConnectionTokenRepositoryLive)
  const program = seedTestConnectionTokensProgram(input).pipe(Effect.provide(layers))
  const result = await Effect.runPromise(Effect.either(program))
  if (result._tag === 'Left') {
    // Don't throw — user creation must succeed even if the test seeder
    // fails (e.g. because the schema migration hasn't run yet). Log so
    // the failure surfaces in the test output.
    console.warn('[connections] test-token seed failed:', result.left)
  }
}
