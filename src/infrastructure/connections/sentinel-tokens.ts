/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Test-mode sentinel token constants and detector.
 *
 * The E2E harness writes these placeholder tokens for the users it signs up,
 * so the encryption-at-rest specs have a row to decrypt and the pre-authorize
 * specs see a "not yet authorized" connection. The server never writes one;
 * it only has to recognise one, which is why the detector lives here, beside
 * the live token repository, the OAuth2 auth-header injection path and the
 * connections `/status` route that ask the question.
 */

/**
 * Sentinel access-token plaintext the E2E harness seeds.
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
 * Detect whether a decrypted access-token plaintext is the harness's
 * sentinel. Used by the connections `/status` route and the OAuth2
 * header-injection path to treat seeded users as "not yet authorized" —
 * without this gate, the seeded 1-hour expiresAt would make every
 * freshly-created user's `scope: 'user'` connections report 'connected',
 * contradicting specs like the automation connection specs that
 * assert pre-auth state.
 *
 * `endsWith('.signature-placeholder')` covers both sentinel literals
 * above plus any future variants that retain the suffix. Equality
 * against the full literal would fail to recognise a sentinel that's
 * been re-encrypted/decrypted with a slightly different payload; suffix
 * match is robust against that.
 *
 * Production safety: this matcher is also safe in production because
 * the server never writes a sentinel — a real provider
 * would never hand back a token with the literal `signature-placeholder`
 * suffix, so a false positive can only occur if someone manually inserts
 * the sentinel into the database.
 */
export const isSentinelAccessToken = (plaintext: string | undefined): boolean =>
  plaintext !== undefined && plaintext.endsWith('.signature-placeholder')
