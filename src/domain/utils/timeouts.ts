/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Centralized timeouts and rate limits used across the infrastructure
 * and presentation layers (audit L6).
 *
 * Why one file: future audits and security reviews can read the entire
 * timeout budget at a glance instead of grepping for inline literals
 * scattered across handlers. Also lets us tune (e.g. tighten an HTTP
 * deadline for tests, lengthen an OAuth state TTL for slow IdPs)
 * without hunting through unrelated code.
 *
 * NOT included here: timeouts that are properly contractual (e.g.
 * Better Auth session lifetimes, Drizzle/Bun:sql connection timeouts)
 * — those belong with their owning library configuration.
 */

/**
 * Bound for outbound HTTP requests issued by the `http/request`
 * automation action. Probe value: bumped from 5s to 15s while we
 * confirm whether contended CI runners (in-process MockServer + 4
 * Playwright workers + main app server) routinely overshoot 5s on the
 * webhook-action fetch path. Production callers can override via
 * per-action config when support for that lands.
 */
export const HTTP_REQUEST_TIMEOUT_MS = 15_000

/**
 * Bound for the OAuth2 token-exchange request fired during /callback.
 * Slightly longer than the action timeout because IdP token endpoints
 * can take a few seconds to respond, especially on cold-start clouds.
 * Kept ≥ HTTP_REQUEST_TIMEOUT_MS by invariant (timeouts.test.ts).
 */
export const OAUTH_CALLBACK_TIMEOUT_MS = 20_000

/**
 * How long an issued OAuth `state` value remains valid in the
 * in-memory store before being purged on next access. Long enough for
 * a slow human to complete an IdP sign-in flow; short enough that a
 * leaked state value can't be replayed indefinitely.
 */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

/**
 * Sliding-window rate limit for public share-link form submissions,
 * applied per source IP. Pair with `formRepo.countRecentByIp` to enforce.
 */
export const SHARE_LINK_RATE_LIMIT_WINDOW_SECONDS = 60
export const SHARE_LINK_RATE_LIMIT_MAX_PER_WINDOW = 10
