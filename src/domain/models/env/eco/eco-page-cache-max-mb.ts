/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_PAGE_CACHE_MAX_MB` env var — memory budget for the in-memory static
 * page-output cache.
 *
 * The cache is bounded by BYTES, not by entry count: 200 marketing pages and
 * 200 long-form docs articles differ by an order of magnitude in size, so an
 * entry cap either starves a docs zone or blows the memory ceiling of a small
 * deployment. Entries are admitted until the budget is reached, after which
 * insertion-order-oldest entries are evicted until the new entry fits.
 *
 * Operator infrastructure: it lives in the environment only, never in the app
 * schema — same contract as `ECO_PAGE_CACHE`.
 */

/** Default budget when `ECO_PAGE_CACHE_MAX_MB` is unset (megabytes). */
export const DEFAULT_ECO_PAGE_CACHE_MAX_MB = 64

/**
 * Resolve `ECO_PAGE_CACHE_MAX_MB` from a snapshot of env vars.
 *
 * - unset / empty            → {@link DEFAULT_ECO_PAGE_CACHE_MAX_MB}
 * - non-integer / `<= 0`     → {@link DEFAULT_ECO_PAGE_CACHE_MAX_MB}
 * - positive integer         → the integer as-is
 *
 * An unrecognised value falls back to the default rather than disabling the
 * bound: a typo must never turn the cache into an unbounded allocator.
 */
export const parseEcoPageCacheMaxMb = (
  processEnv: Readonly<Record<string, string | undefined>>
): number => {
  const raw = processEnv['ECO_PAGE_CACHE_MAX_MB']?.trim()
  if (raw === undefined || raw === '') return DEFAULT_ECO_PAGE_CACHE_MAX_MB
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ECO_PAGE_CACHE_MAX_MB
  return parsed
}
