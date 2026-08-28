/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-process counters describing how the static page-output cache performed.
 *
 * ## Why this is not inside the cache service
 *
 * The cache itself lives in `infrastructure/server/cache/page-cache-service.ts`,
 * and `infrastructure-server` is deliberately closed to API routes — an admin
 * handler reaching into the server's own route-setup tree is how import cycles
 * start. Telemetry ABOUT the cache is not the cache, so it lives here beside
 * `eco-index-tracker.ts`, the codebase's other process-global counter read by
 * that same footprint route. Both are pure counters: no I/O, no DI, no Effect.
 *
 * ## The occupancy figures are pushed, and that is load-bearing
 *
 * `entries` and `bytes` describe a `Ref<Map>` this module cannot see, so the
 * cache service publishes them. The invariant that keeps the mirror honest is
 * that the cache has exactly TWO state mutators — `setCachedPage` and
 * `clearPageCache` — and both publish from inside the update that produced the
 * new map. A third mutator added without a publish call would leave this panel
 * confidently reporting an occupancy that no longer exists, which is precisely
 * the defect class the footprint surface exists to retire; the cache service
 * carries a comment saying so.
 */

import { parseEcoPageCache } from '@/domain/models/env/eco/eco-page-cache'
import { parseEcoPageCacheMaxMb } from '@/domain/models/env/eco/eco-page-cache-max-mb'
import { readTelemetryEpoch } from '@/infrastructure/utils/telemetry-epoch'

/**
 * Cache disposition of one page response, as reported on `X-Render-Cache`:
 * `hit` (served from the cache), `miss` (rendered, then stored), `bypass`
 * (not cacheable, authenticated, preview, or `ECO_PAGE_CACHE=off`).
 */
export type PageCacheOutcome = 'hit' | 'miss' | 'bypass'

/** What one admission attempt did to the store. */
export interface PageCacheAdmission {
  /** Entries dropped to make room for the new one. */
  readonly evicted: number
  /** `1` when the entry exceeded the whole budget and was refused outright. */
  readonly refused: number
  /** Entries held after the admission settled. */
  readonly entries: number
  /** Total UTF-8 bytes held after the admission settled. */
  readonly bytes: number
}

/** Page-cache telemetry for the footprint overview. */
export interface PageCacheStats {
  /** `ECO_PAGE_CACHE` posture — `false` means every render reports `bypass`. */
  readonly enabled: boolean
  readonly hits: number
  readonly misses: number
  readonly bypasses: number
  /**
   * `hits / (hits + misses)`, rounded to three decimals — or `null` when no
   * CACHEABLE render has happened yet.
   *
   * Bypasses are excluded from the denominator on purpose: a bypassed render
   * was never offered to the cache, so counting it as a miss would report a
   * cache that keeps failing when in fact it was never consulted.
   */
  readonly hitRate: number | null
  /** Entries currently held. */
  readonly entries: number
  /** Total UTF-8 bytes of HTML currently held. */
  readonly bytes: number
  /** The live `ECO_PAGE_CACHE_MAX_MB` ceiling, in bytes. */
  readonly budgetBytes: number
  /** Entries dropped to stay inside the budget, since boot. */
  readonly evictions: number
  /** Renders refused admission for exceeding the whole budget alone, since boot. */
  readonly refusals: number
  /** ISO 8601 boot epoch the four counters are measured from. */
  readonly since: string
}

// eslint-disable-next-line functional/no-let -- since-boot counter mutated by the page responder
let hits = 0
// eslint-disable-next-line functional/no-let -- since-boot counter mutated by the page responder
let misses = 0
// eslint-disable-next-line functional/no-let -- since-boot counter mutated by the page responder
let bypasses = 0
// eslint-disable-next-line functional/no-let -- since-boot counter mutated on budget eviction
let evictions = 0
// eslint-disable-next-line functional/no-let -- since-boot counter mutated when an entry exceeds the whole budget
let refusals = 0
// eslint-disable-next-line functional/no-let -- occupancy mirror, republished by every cache mutation
let entries = 0
// eslint-disable-next-line functional/no-let -- occupancy mirror, republished by every cache mutation
let bytes = 0

/**
 * Record how one page response was served. Called from the page responder for
 * every HTML render, cached or not.
 */
export const recordPageCacheOutcome = (outcome: PageCacheOutcome): void => {
  if (outcome === 'hit') {
    // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
    hits += 1
    return
  }
  if (outcome === 'miss') {
    // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
    misses += 1
    return
  }
  // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
  bypasses += 1
}

/** Record the outcome of one admission attempt and the occupancy it left behind. */
export const recordPageCacheAdmission = (admission: PageCacheAdmission): void => {
  // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
  evictions += admission.evicted
  // eslint-disable-next-line functional/no-expression-statements -- counter mutation is the point
  refusals += admission.refused
  publishPageCacheOccupancy(admission)
}

/**
 * Republish occupancy after a non-admission mutation — today, the cache being
 * cleared. Separate from {@link recordPageCacheAdmission} because clearing is
 * not an eviction: nothing was displaced under budget pressure, and folding it
 * into the eviction count would make a hot-reload look like a cache too small
 * for its workload.
 */
export const publishPageCacheOccupancy = (occupancy: {
  readonly entries: number
  readonly bytes: number
}): void => {
  const { entries: nextEntries, bytes: nextBytes } = occupancy
  // eslint-disable-next-line functional/no-expression-statements -- occupancy mirror update
  entries = nextEntries
  // eslint-disable-next-line functional/no-expression-statements -- occupancy mirror update
  bytes = nextBytes
}

/**
 * Read the cache's occupancy and its since-boot outcome counters.
 *
 * `enabled` and `budgetBytes` are resolved from the environment at read time,
 * matching how the decision layer resolves them per request — an operator who
 * flips `ECO_PAGE_CACHE` sees the panel change on the next refresh, with no
 * restart.
 */
export const readPageCacheStats = (): PageCacheStats => {
  const cacheable = hits + misses
  return {
    enabled: parseEcoPageCache(process.env) === 'on',
    hits,
    misses,
    bypasses,
    // eslint-disable-next-line unicorn/no-null -- `null` is "no cacheable render yet", deliberately distinct from a measured rate of 0
    hitRate: cacheable === 0 ? null : Number((hits / cacheable).toFixed(3)),
    entries,
    bytes,
    budgetBytes: parseEcoPageCacheMaxMb(process.env) * 1024 * 1024,
    evictions,
    refusals,
    since: readTelemetryEpoch(),
  }
}

/**
 * Reset the counters at server boot.
 *
 * Same rationale as the eco-index tracker's boot reset: a no-op in production,
 * load-bearing under the E2E harness, which restarts the server between specs
 * inside one Bun process. The occupancy mirror is reset too — the harness
 * clears the cache itself on boot, so leaving a stale occupancy here would
 * report entries the new server does not hold.
 */
export const resetPageCacheStatsAtBoot = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  hits = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  misses = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  bypasses = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  evictions = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  refusals = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  entries = 0
  // eslint-disable-next-line functional/no-expression-statements -- boot reset
  bytes = 0
}
