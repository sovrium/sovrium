/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator's `design` cascading onto the embedded console.
 *
 * [internal ref] A4 and [internal ref] D4 already ruled this: *"only the `design` key of the
 * operator's own config cascades into the console — colours, spacing,
 * typography. Page structure, routes and the admin backend are untouchable, the
 * Sovrium branded default applies wherever the operator configured nothing."*
 * Until this module the ruling had no runtime: the console rendered from a
 * preset declaring no theme, so an operator's tokens reached its chrome not at
 * all..
 *
 * ─── WHERE THE "SOVRIUM DEFAULT WHERE NOT CONFIGURED" HALF COMES FROM ──────
 *
 * NOT from an object merge, and this is the fact the whole design turns on.
 * `buildDefaultLayer` (`infrastructure/css/compiler.ts`) emits `V1_TOKEN_LAYER`
 * + `ROLE_TOKEN_BRIDGE` into EVERY app's stylesheet before anything authored,
 * and the bridge resolves each role through an `author key → legacy → default`
 * fallback chain. So the reference value for an undeclared token is already the
 * one that resolves, per TOKEN, in the cascade — for the operator's own pages
 * exactly as for the console's.
 *
 * That makes the object-level rule the SHALLOWEST one available: a cascading
 * key is taken from the operator WHOLE, or not at all. Deep-merging the
 * reference into it would be actively wrong rather than merely redundant —
 * `theme.colors` is an open record, and Sovrium's default carries 306 value
 * declarations whose spellings include CSS `var()` fallback chains that
 * `DesignThemeSchema` cannot hold. That is precisely why
 * `apps/admin/config/design.ts` keeps `DEFAULT_DESIGN_SOURCE` as a NAMED export
 * feeding a generator, rather than as the app's own `design` ([internal ref] refused
 * widening the config surface to hold those chains). There is no in-schema
 * object to deep-merge with.
 *
 * ─── THE SEVEN THAT CASCADE, AND THE FIVE THAT DO NOT ──────────────────────
 *
 * {@link CASCADING_DESIGN_KEYS} carries the TOKEN and STYLE families. The five
 * omitted keys are omitted for a reason per key, not by oversight:
 *
 *  - **`zones`** — a route→zone MAP. The operator's patterns name the
 *    operator's routes; against console paths they match nothing, so importing
 *    them would leave every console page zone-less and silently break
 *    `density.perZone`. The console's own single-zone map is also what
 *    `Brand Zone Drift` validates against `apps/admin`'s pages.
 *  - **`logo`** — identity, not a token. The console IS Sovrium; putting the
 *    operator's mark on it credits the vendor's product to the operator, which
 *    is the same reason `apps/admin/app.ts` declares `badge: false`.
 *  - **`voice`, `principles`, `imagery`** — authoring guidance addressed to
 *    whoever writes the OPERATOR's surfaces. The console's own writing is
 * Sovrium's operator register and its assets are Sovrium's.
 *
 * ─── WHAT THE OPERATOR STILL CANNOT DO ────────────────────────────────────
 *
 * Degrade it. `design.components` cascades, and a class list that zeroes the
 * focus ring is a legal thing to write — so `componentFloorFor`
 * (`presentation/utils/design/component-floor.ts`) replays each recipe's own
 * accessibility block AFTER the operator's classes, in the console exactly as
 * in the operator's app. The floor is not part of this cascade and cannot be
 * reached by it.
 */

import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'

/**
 * The `design` keys an operator's config cascades into the console.
 *
 * Ordered as the design key itself reads: colour, then the token foundations,
 * then what applies them. Most reach a CSS emitter; `ramps` and `colorRoles` do
 * not — they are read only by the design-system documentation surfaces, and no
 * generator in `buildSourceCSS` consults them. They cascade anyway, so that the
 * day one of them gains an emitter the console inherits it without a second
 * decision — and {@link designCascadeKey} keys on the whole set rather than on
 * the emitting subset, so that day cannot arrive with a stale stylesheet URL
 * behind it.
 *
 * `logo`, `imagery`, `principles`, `voice` and `zones` are deliberately NOT
 * here. The charter four are the operator's WORDS and marks, which the console
 * documents rather than wears; `zones` is a route map the console's own routes
 * do not answer to. That exclusion is [internal ref]'s call and is preserved verbatim
 * across the flattening — this change moved keys, it did not re-open which ones
 * cascade.
 */
export const CASCADING_DESIGN_KEYS = [
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

/** The subset of a `design` block that cascades, with undeclared keys absent. */
const cascadingSubset = (design: Design | undefined): Partial<Design> =>
  design === undefined
    ? {}
    : Object.fromEntries(
        CASCADING_DESIGN_KEYS.filter((key) => design[key] !== undefined).map((key) => [
          key,
          design[key],
        ])
      )

/**
 * The console preset carrying the operator's declared design.
 *
 * Returns the preset UNCHANGED when the operator declares nothing that
 * cascades. That identity is load-bearing rather than an optimisation: it is
 * what keeps an undesigned instance's console stylesheet — its bytes, its
 * compile-cache entry and its `immutable` URL — byte-identical to what they
 * were before the cascade existed.
 *
 * The tokens are written ONCE. This function used to write them to both of the
 * positions the token block had, because the two halves of the pipeline read
 * different ones — the class recipes one, the design-system surfaces the
 * other. There is one position now, so the dual write is gone and with it the
 * class of bug where the two could disagree.
 *
 * @param presetApp - the embedded console preset (mount-relative, unthemed).
 * @param operatorApp - the operator's decoded config.
 */
export const withOperatorDesignCascade = (presetApp: App, operatorApp: App): App => {
  const cascaded = cascadingSubset(operatorApp.design)
  if (Object.keys(cascaded).length === 0) return presetApp
  return {
    ...presetApp,
    design: {
      ...presetApp.design,
      ...cascaded,
    },
  } as App
}

/**
 * The compile identity of the cascading design families carried by an app.
 *
 * Read off the RENDERING app rather than off the operator's, so it states what
 * the stylesheet was compiled from rather than where it came from. The console
 * preset declares none of these keys itself, so on a console surface this is
 * exactly the cascade — and on an app that did declare one, it is still the
 * honest answer to the only question the hash asks.
 *
 * It deliberately keys on EVERY cascading key, including the two that reach no
 * emitter today. Over-keying costs one cache miss on a config change that
 * happens not to move a byte; under-keying serves one operator's
 * `immutable`-cached console stylesheet for another's document, which is the
 * bug the versioned URL exists to prevent. The asymmetry is the whole argument,
 * and it is what keeps this function from rotting when `design.ramps` gains a
 * generator.
 *
 * Empty when nothing cascades, which is what preserves the byte-identity above.
 */
export const designCascadeKey = (app?: App): string => {
  const cascaded = cascadingSubset(app?.design)
  if (Object.keys(cascaded).length === 0) return ''
  return `::design-cascade::${JSON.stringify(cascaded)}`
}

/**
 * The operator's app, projected down to what a SCOPED design layer may see.
 *
 * ─── BUILT FIELD BY FIELD, NEVER SPREAD ────────────────────────────────────
 *
 * `tables`, `env`, `auth`, `automations` and everything else stay behind, so
 * [internal ref] A2's confidentiality bound holds BY CONSTRUCTION rather than by a
 * redaction pass someone has to remember to extend. A spread with an omit list
 * is the same object one forgotten key later.
 *
 * ─── WHY EVERY MOUNTED SURFACE CARRIES IT, NOT JUST THE DESIGN SECTION ─────
 *
 * All of a mount's surfaces share ONE stylesheet identity — a per-surface hash
 * would be unresolvable from a route that sees only a hash — so the scope has to
 * be uniform across the family too. Attaching it only to the design-system pages
 * would split the mount into two stylesheet identities and leave the CSS route
 * guessing which one a hash meant. The cost is one inert token layer on pages
 * that draw no scope, inert because nothing outside a `[data-design-app-scope]`
 * subtree can match its selector.
 *
 * It moved here out of the console's own surface builders when that console
 * became config. Nothing about it was ever a page: it is a projection of one
 * app into another's stylesheet, which is what the rest of this module is
 * about.
 */
export const buildDesignSystemScopeApp = (operatorApp: App): App => {
  return {
    name: operatorApp.name,
    design: operatorApp.design,
    components: operatorApp.components,
    languages: operatorApp.languages,
    // A specimen is Sovrium's own documentation surface, not a generated app
    // page: no "Built with Sovrium" badge, and no auto-appended record palette
    // (which would mount a search island in a document that has no records).
    badge: false,
    palette: { enabled: false },
  } as unknown as App
}
