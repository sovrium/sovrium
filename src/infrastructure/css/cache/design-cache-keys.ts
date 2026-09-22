/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which `design` keys the compiled stylesheet depends on, and the cache key
 * derived from them.
 *
 * ## Why this module exists, and why it now covers everything
 *
 * It used to hold three narrow segments — `density`, `components`, `typeScale` —
 * appended to a key whose main term was `JSON.stringify(app.design)`. That was
 * safe for one structural reason and no other: every other CSS-bearing token
 * lived INSIDE `app.design`, so hashing the container wholesale covered all of
 * them for free. Only the three keys that had escaped the container to sit on
 * `design` needed naming here.
 *
 * [internal ref] removes the container. `colors`, `spacing`, `radius`, `elevation`,
 * `breakpoints` and the rest are now direct keys of `design`, so the wholesale
 * hash that used to cover them covers nothing, and a three-key list would leave
 * a palette out of the cache key entirely. The failure that produces is not a
 * stale render but a CROSS-APP one: two apps sharing a candidate corpus and
 * differing only in their colours would key identically, and whichever compiled
 * first would have its stylesheet served to the other.
 *
 * So the list below is the whole CSS-bearing surface, and adding a design key
 * that reaches an emitter means adding it here in the same change. The two
 * error directions are deliberately asymmetric: naming a key that reaches no
 * emitter costs a cache miss, and omitting one that does costs correctness.
 * When in doubt, include it.
 *
 * ## What is excluded, and why that is safe
 *
 * `zones`, `logo`, `imagery`, `principles` and `voice` — routes and words. None
 * of them reaches `generateDesignCSS`, `buildDefaultLayer`, `generateBaseLayer`,
 * `generateComponentsLayer`, `generateCodeBlockStyles`, `generateMotionStyles`
 * or `generateDensityLayer`, so two apps differing only in their voice compile
 * the same bytes and should share a cache entry. They are excluded because they
 * are inert HERE, not because they are unimportant; if one of them ever grows
 * an emitter, it belongs in the list.
 */

import type { Design } from '@/domain/models/app/design'

/**
 * Every `design` key whose declaration can move the compiled bytes.
 *
 * Ordered as `DesignSchema` declares them, so the two can be read side by side
 * and a missing entry is visible rather than inferred.
 */
export const CSS_BEARING_DESIGN_KEYS = [
  'colorScheme',
  'colors',
  'darkColors',
  'ramps',
  'colorRoles',
  'typeScale',
  'spacing',
  'radius',
  'elevation',
  'motion',
  'breakpoints',
  'density',
  'baseline',
  'codeBlock',
  'components',
] as const satisfies readonly (keyof Design)[]

/**
 * Recursively sort object keys so serialization is insertion-order independent.
 *
 * Two configs declaring the same tokens in a different order describe the same
 * stylesheet and must share a cache entry; without this they would key
 * differently and compile twice.
 */
const sortObjectKeys = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortObjectKeys)

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .toSorted()
      .map((key) => [key, sortObjectKeys(record[key])])
  )
}

/**
 * The CSS-bearing subset of a design, with undeclared keys omitted.
 *
 * Omission rather than an explicit `undefined` is what keeps the key of an app
 * declaring only `voice` identical to the key of an app declaring nothing —
 * the property that lets both share the app-agnostic compile.
 */
const cssBearingDesign = (design?: Design): Readonly<Record<string, unknown>> =>
  design === undefined
    ? {}
    : Object.fromEntries(
        CSS_BEARING_DESIGN_KEYS.filter((key) => design[key] !== undefined).map((key) => [
          key,
          design[key],
        ])
      )

/**
 * The `design` half of the compiled-CSS cache key.
 *
 * `'{}'` when nothing CSS-bearing is declared — the same string an absent
 * `design` produces, so the two cases share a cache entry.
 *
 * @param design - the app's `design` key.
 *
 * @example
 * // Same tokens, different declaration order → the SAME key:
 * designCacheKey({ colors: { primary: '#f00' }, spacing: { '4': '1rem' } })
 * designCacheKey({ spacing: { '4': '1rem' }, colors: { primary: '#f00' } })
 */
export const designCacheKey = (design?: Design): string =>
  JSON.stringify(sortObjectKeys(cssBearingDesign(design)))

/**
 * The key an app declaring nothing CSS-bearing produces.
 *
 * Named rather than spelled `'{}'` at the call site, because the shape of the
 * empty key is this module's business: a caller comparing against a literal
 * would silently stop matching the day the serialization changes.
 */
export const EMPTY_DESIGN_CACHE_KEY = designCacheKey(undefined)
