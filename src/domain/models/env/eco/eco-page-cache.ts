/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_PAGE_CACHE` env var — operator toggle for the in-memory static
 * page-output cache.
 *
 * Frugal-by-default: the cache is `on` unless an operator explicitly opts out.
 * Caching request-invariant ("static") page HTML avoids re-running
 * `renderToString` on every request — one of the strongest CPU-side
 * ecoconception levers (mirrors `ECO_MODE`, `ECO_IMAGE_FORMAT` defaulting to
 * the eco-aligned setting).
 */
export type EcoPageCacheMode = 'on' | 'off'

/** Default when `ECO_PAGE_CACHE` is unset (eco-aligned). */
export const DEFAULT_ECO_PAGE_CACHE: EcoPageCacheMode = 'on'

/**
 * Resolve `ECO_PAGE_CACHE` from a snapshot of env vars. Only an explicit
 * `off` (case-insensitive, surrounding whitespace ignored) disables the
 * cache — an unset, empty, or unrecognised value resolves to the eco-aligned
 * default (`on`). Operators opt out, they never opt in.
 */
export const parseEcoPageCache = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoPageCacheMode => {
  const raw = processEnv['ECO_PAGE_CACHE']?.trim().toLowerCase()
  return raw === 'off' ? 'off' : DEFAULT_ECO_PAGE_CACHE
}
