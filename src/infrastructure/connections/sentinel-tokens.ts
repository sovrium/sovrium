/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Test-mode sentinel token constants and detector.
 *
 * Extracted from `test-token-seeder.ts` so non-test consumers — the live
 * token repository (`connection-token-repository-live.ts`), the OAuth2
 * auth-header injection path (`action-handlers/auth-headers.ts`), and the
 * connections `/status` route — can reach the predicate without depending
 * on the test-only seeder module. Keeps the live code path independent of
 * test scaffolding: production code stays import-clean of `test-*`
 * filenames, and refactors to the seeder no longer ripple into the live
 * repo or auth-header injector.
 *
 * Architectural note (REC-C4-7, Wave-2 audit, 2026-05-01): an earlier
 * version of this docstring claimed the extraction broke an import cycle.
 * That was incorrect — the seeder reaches the live repo via dynamic
 * `await import(...)` at runtime, so a top-level static import of the
 * sentinel predicate from the live repo would NOT have closed a cycle.
 * The extraction is still architecturally correct (test/live decoupling),
 * but the rationale is decoupling, not cycle-breaking.
 *
 * The sentinel literals exist solely to satisfy the encryption-at-rest
 * specs (APP-AUTOMATION-CONNECTION-025/070) — production never sees them
 * because `runSeedTestConnectionTokens` no-ops when
 * `NODE_ENV === 'production'`.
 */

/**
 * Sentinel access-token plaintext written by `seedTestConnectionTokensProgram`.
 * Starts with `eyJ` so specs can assert "encrypted column does NOT match
 * plaintext JWT shape, but DOES decrypt back to one". The base64-encoded
 * payload is a static placeholder — it's NOT a real JWT, just shaped
 * like one.
 */
export const SENTINEL_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXNlZWQifQ.signature-placeholder'

/**
 * Sentinel refresh-token plaintext. Same shape rationale as the access
 * token; the differing `sub` claim lets specs that decrypt both fields
 * tell them apart without false positives.
 */
export const SENTINEL_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXNlZWQtcmVmcmVzaCJ9.signature-placeholder'

/**
 * Detect whether a decrypted access-token plaintext is the test seeder's
 * sentinel. Used by the connections `/status` route and the OAuth2
 * header-injection path to treat seeded users as "not yet authorized" —
 * without this gate, the seeder's 1-hour expiresAt would make every
 * freshly-created user's `scope: 'user'` connections report 'connected',
 * contradicting specs like APP-AUTOMATION-CONNECTION-072 / -077 that
 * assert pre-auth state.
 *
 * `endsWith('.signature-placeholder')` covers both sentinel literals
 * above plus any future variants that retain the suffix. Equality
 * against the full literal would fail to recognise a sentinel that's
 * been re-encrypted/decrypted with a slightly different payload; suffix
 * match is robust against that.
 *
 * Production safety: this matcher is also safe in production because
 * the seeder no-ops when NODE_ENV === 'production' — a real provider
 * would never hand back a token with the literal `signature-placeholder`
 * suffix, so a false positive can only occur if someone manually inserts
 * the sentinel into the database.
 */
export const isSentinelAccessToken = (plaintext: string | undefined): boolean =>
  plaintext !== undefined && plaintext.endsWith('.signature-placeholder')
