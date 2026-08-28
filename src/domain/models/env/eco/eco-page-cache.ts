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
 * ecoconception levers.
 */
import { parseEcoEnum } from './eco-env-parsing'

export type EcoPageCacheMode = 'on' | 'off'

const ECO_PAGE_CACHE_MODES: readonly EcoPageCacheMode[] = ['on', 'off']

/** Default when `ECO_PAGE_CACHE` is unset (eco-aligned). */
export const DEFAULT_ECO_PAGE_CACHE: EcoPageCacheMode = 'on'

/**
 * Resolve `ECO_PAGE_CACHE` from a snapshot of env vars. An unset or empty
 * value resolves to the eco-aligned default (`on`); only an explicit `off`
 * (case-insensitive, surrounding whitespace ignored) disables the cache.
 *
 * A SET-but-unrecognised value throws — `ECO_PAGE_CACHE=0` used to
 * read as `on`, so an operator debugging a stale-page problem kept serving
 * cached HTML while believing the cache was off.
 *
 * @throws Error when set to anything other than `on` or `off`.
 */
export const parseEcoPageCache = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoPageCacheMode =>
  parseEcoEnum('ECO_PAGE_CACHE', processEnv['ECO_PAGE_CACHE'], {
    allowed: ECO_PAGE_CACHE_MODES,
    fallback: DEFAULT_ECO_PAGE_CACHE,
  })
