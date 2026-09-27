/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DensityStepName } from './density'
import type { Design } from './design'

/**
 * Which density step a page runs at.
 *
 * ## The order
 *
 * 1. `design.density.byZone[zone]`, where `zone` is the `design.zones[]` entry
 *    that GOVERNS the page;
 * 2. `design.density.default`;
 * 3. `compact` — the step the platform has always rendered at, so an app that
 *    declares nothing renders exactly as it did before the key existed.
 *
 * ## Why the page's DECLARED path, not the served URL
 *
 * Zone patterns are written as declared (`/docs/*`, never `/{lang}/docs/*`),
 * and the engine prefixes the active locale when it serves a page. Matching the
 * served URL would therefore miss every locale-prefixed request. A declared
 * path that is itself lang-prefixed (`/en/docs/:slug`) has that prefix stripped
 * the same way the pattern has, so both sides are compared in one vocabulary.
 *
 * ## Why a copy of the zone grammar, and not an import of it
 *
 * `[internal ref]` states the grammar the Brand Zone Drift gate
 * applies, and `src/` may not import from `scripts/`. The rules below are that
 * grammar restated, not a variant of it — if the two ever disagree, the gate and
 * the runtime would disagree about which zone a page belongs to:
 *
 * - a pattern matches a path when its segments are a SEGMENT-WISE PREFIX of the
 *   path's — a zone owns its own index and everything below it, so `/` governs
 *   every page;
 * - `*` matches exactly one segment, and a trailing `*` is redundant;
 * - `{lang}` / `:lang` match any declared language code;
 * - the phrase `everything else` (any casing) is the catch-all;
 * - surrounding whitespace is ignored, and a pattern that is neither the
 *   catch-all nor root-relative (`docs`) governs nothing — the gate REFUSES it
 *   rather than reading it as `/docs`, so the runtime must not read it so either;
 * - among several matches the MOST SPECIFIC wins (most literal segments, then
 *   most segments, then longest pattern), the catch-all ranks last, and a tie
 *   breaks on the pattern text (a catch-all's, then its zone name).
 *
 * `[internal ref]` feeds both implementations one
 * table and fails the moment they name different zones for the same path.
 */

const LANG_PLACEHOLDERS: ReadonlySet<string> = new Set(['{lang}', ':lang'])

const CATCH_ALL_PHRASE = /^everything\s+else$/i

/** The step a page runs at when neither its zone nor the app names one. */
const FALLBACK_DENSITY_STEP: DensityStepName = 'compact'

interface RankedZone {
  readonly zone: string
  readonly catchAll: boolean
  readonly pattern: string
  readonly segments: readonly string[]
}

const pathSegments = (path: string): readonly string[] => path.split('/').filter((s) => s !== '')

const stripLangPrefix = (
  segments: readonly string[],
  codes: readonly string[]
): readonly string[] => {
  const [first] = segments
  if (first === undefined) return segments
  return codes.includes(first) || LANG_PLACEHOLDERS.has(first) ? segments.slice(1) : segments
}

const dropTrailingWildcards = (segments: readonly string[]): readonly string[] =>
  segments.at(-1) === '*' ? dropTrailingWildcards(segments.slice(0, -1)) : segments

/** `undefined` for a pattern the grammar refuses — it then governs nothing. */
const toRankedZone = (
  entry: { readonly pattern: string; readonly zone: string },
  codes: readonly string[]
): RankedZone | undefined => {
  const trimmed = entry.pattern.trim()
  if (CATCH_ALL_PHRASE.test(trimmed)) {
    return { zone: entry.zone, catchAll: true, pattern: entry.pattern, segments: [] }
  }
  if (!trimmed.startsWith('/')) return undefined
  const segments = dropTrailingWildcards(stripLangPrefix(pathSegments(trimmed), codes))
  return { zone: entry.zone, catchAll: false, pattern: `/${segments.join('/')}`, segments }
}

const matches = (
  entry: RankedZone,
  segments: readonly string[],
  codes: readonly string[]
): boolean =>
  entry.catchAll ||
  (entry.segments.length <= segments.length &&
    entry.segments.every((patternSegment, index) => {
      const pathSegment = segments[index] ?? ''
      if (patternSegment === '*') return true
      if (LANG_PLACEHOLDERS.has(patternSegment)) return codes.includes(pathSegment)
      return patternSegment === pathSegment
    }))

const rank = (entry: RankedZone): readonly [number, number, number] =>
  entry.catchAll
    ? [-1, -1, 0]
    : [
        entry.segments.filter((s) => s !== '*' && !LANG_PLACEHOLDERS.has(s)).length,
        entry.segments.length,
        entry.pattern.length,
      ]

/**
 * The text a tie breaks on — the gate's own key: the normalized pattern, and for
 * a catch-all (which has none) the entry as the gate reports it, so two
 * catch-alls are ordered by zone name rather than by declaration order.
 */
const tieKey = (entry: RankedZone): string =>
  entry.catchAll ? `\`${entry.pattern}\` → ${entry.zone}` : entry.pattern

const moreSpecific = (best: RankedZone, candidate: RankedZone): RankedZone => {
  const [bl, bs, bp] = rank(best)
  const [cl, cs, cp] = rank(candidate)
  if (cl !== bl) return cl > bl ? candidate : best
  if (cs !== bs) return cs > bs ? candidate : best
  if (cp !== bp) return cp > bp ? candidate : best
  return tieKey(candidate) < tieKey(best) ? candidate : best
}

/**
 * The zone that governs a declared page path — the most specific
 * `design.zones[]` match — or `undefined` when the app declares no zone map or
 * no entry matches. Pure.
 */
export const resolveGoverningZone = (
  zones: readonly { readonly pattern: string; readonly zone: string }[] | undefined,
  pagePath: string,
  languageCodes: readonly string[] = []
): string | undefined => {
  if (zones === undefined || zones.length === 0) return undefined
  const segments = stripLangPrefix(pathSegments(pagePath), languageCodes)
  const matching = zones
    .map((entry) => toRankedZone(entry, languageCodes))
    .filter(
      (entry): entry is RankedZone => entry !== undefined && matches(entry, segments, languageCodes)
    )
  const [first, ...rest] = matching
  return first === undefined ? undefined : rest.reduce(moreSpecific, first).zone
}

/**
 * The density step a page runs at: its zone's `byZone` step, else the app's
 * `density.default`, else `compact`. Pure.
 *
 * @param pagePath - the page's DECLARED `path` (or a standalone form's), never
 *   the served URL — see the module doc.
 * @param languageCodes - the app's declared language codes, stripped from a
 *   lang-prefixed declared path before matching.
 */
export const resolveDensityStep = (
  design: Pick<Design, 'density' | 'zones'> | undefined,
  pagePath: string,
  languageCodes: readonly string[] = []
): DensityStepName => {
  const density = design?.density
  if (density === undefined) return FALLBACK_DENSITY_STEP
  const zone =
    density.byZone === undefined
      ? undefined
      : resolveGoverningZone(design?.zones, pagePath, languageCodes)
  const zoneStep = zone === undefined ? undefined : density.byZone?.[zone]
  return zoneStep ?? density.default ?? FALLBACK_DENSITY_STEP
}
