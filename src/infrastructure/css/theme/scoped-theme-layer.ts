/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SCOPED token layer — the platform's whole token vocabulary re-emitted
 * under a selector instead of under `:root`, so a subtree of one document can
 * resolve a DIFFERENT design system from the document around it.
 *
 * Its only consumer today is the design-system console, which draws the
 * operator's system flat inside Sovrium's own chrome ([internal ref] A2). Before
 * 2026-09-02 that isolation was an `<iframe>`: two documents, two `:root`s, no
 * cascade to reason about. The founder removed the frames wholesale, so the
 * boundary has to be expressed inside one document — which is what this module
 * is.
 *
 * ─── WHY RE-DECLARING `--sv-*` IS NOT ENOUGH (MEASURED, TWICE) ──────────────
 *
 * The obvious implementation wraps the subtree and re-declares the role tokens.
 * It reads back perfectly and paints nothing. Measured in a real browser on
 * `/_admin`, by wrapping an element classed `bg-background`:
 *
 *   --sv-bg              read on the wrapper → "#ff0000"        (looks correct)
 *   class="bg-background" painted            → oklch(0.985 0 0) (STALE)
 *   --color-background   at :root            → oklch(0.985 0 0)
 *   --color-background   on the wrapper      → oklch(0.985 0 0) (BYTE-IDENTICAL)
 *
 * `default-theme-layer.ts` declares `--color-<role>: var(--sv-<role>)` ONCE, in
 * a `@theme` block that Tailwind hoists to `:root`. The alias therefore RESOLVES
 * at `:root` and inherits into the wrapper as a literal — every Tailwind utility
 * reads the alias, so every utility inside an `--sv-*`-only wrapper paints the
 * chrome's colours under a correct-looking token readback.
 *
 * A scope is correct only when `--color-*` read ON it DIFFERS from `--color-*`
 * at `:root`. That is why this module emits all THREE tiers and not one:
 *
 *   1. the ramps           (`--sv-neutral-*`, `--sv-success-*`, …)
 *   2. the role vars       (`--sv-bg`, `--sv-fg`, `--sv-primary`, …)
 *   3. the `--color-*` ALIASES, as plain declarations on the scope
 *
 * ─── AND `color-scheme`, WHICH IS TIER FOUR ────────────────────────────────
 *
 * `:root` carries `color-scheme: light`. Without re-declaring it, native
 * controls and scrollbars inside a dark-scoped specimen paint light chrome on a
 * dark surface — the one part of a rendered form the token layer cannot reach.
 * Both `V1_ROOT_LIGHT` and `V1_ROOT_DARK` already declare it, so re-emitting
 * their bodies carries it for free.
 *
 * ─── A SPECIFICITY WORRY THAT IS NOT REAL ──────────────────────────────────
 *
 * Tailwind emits further `:root` blocks AFTER this layer. They cannot mask it:
 * `:root` never matches the wrapper element, and a declaration made ON an
 * element always beats a value INHERITED into it, whatever the source order.
 * (That is a different question from the one `V1_ROOT_DARK`'s `html` prefix
 * answers — there, two selectors both match `<html>` and specificity decides.)
 *
 * ─── ONE SCHEME AXIS, AND WHY THERE USED TO BE TWO ─────────────────────────
 *
 * The scope's dark arm is keyed off `.dark` on an ANCESTOR — the document's own
 * scheme class, the one the shared no-FOUC script and the `theme-toggle`
 * runtime write from `localStorage.theme`. Chrome and scope therefore read ONE
 * input, and the section can never be half dark. The selector sits at
 * specificity (0,2,0) so it beats the scope's own light block (0,1,0).
 *
 * It was keyed off a class ON the scope until 2026-09-03, so that the console's
 * scheme and the specimen's could differ ("a light app documented inside a dark
 * console", `[internal ref]` as first written). That was right while
 * the specimen was a bordered panel inside a console page and wrong the moment
 * the v2 pages made the cards the whole body: with a stored dark theme the
 * chrome went dark from `html.dark`, the scope stayed light from `?scheme=`, and
 * an operator met eighty-five near-white cards on a near-black shell. The two
 * axes were two INPUTS nobody had asked to agree, and every spec was green
 * because Playwright carries no stored theme. Founder ruling: one axis.
 */

import {
  NEUTRAL_FLOOR_ROOT_DARK,
  NEUTRAL_FLOOR_ROOT_LIGHT,
  ROLE_TOKEN_BRIDGE,
  V1_ROOT_DARK,
  V1_ROOT_LIGHT,
  V1_THEME_COLOR_REGISTRATIONS,
} from './default-theme-layer'
import {
  generateAuthorSvBridge,
  generateDarkColorOverrides,
  generateThemeBorderRadius,
  generateThemeColors,
  generateThemeFonts,
  generateMotionScale,
  generateSpacingScale,
  generateThemeShadows,
  generateThemeTypeScale,
} from './theme-generators'
import type { Design } from '@/domain/models/app/design'

/**
 * The attribute marking the subtree that carries a DIFFERENT design system from
 * the document around it.
 *
 * An attribute rather than a class because it is the page's own statement of
 * "the operator's system is drawn from here down", which is a fact about the
 * markup rather than about the styling. The specs address it under this name.
 */
export const DESIGN_SCOPE_ATTRIBUTE = 'data-design-app-scope'

/** The CSS selector the scoped LIGHT block is emitted under. */
export const DESIGN_SCOPE_SELECTOR = `[${DESIGN_SCOPE_ATTRIBUTE}]`

/**
 * The selector the scoped DARK block is emitted under, at specificity (0,2,0).
 *
 * `.dark` is the document's scheme class — the same one the compiler's
 * `@custom-variant dark (&:is(.dark *))` reads, so the token arm and every
 * `dark:` utility inside the scope flip on the same class at the same moment.
 * A descendant selector rather than `html.dark` so the layer stays honest under
 * a test harness that puts the class on any ancestor; nothing else about it
 * depends on WHICH ancestor carries it.
 */
export const DESIGN_SCOPE_DARK_SELECTOR = `.dark ${DESIGN_SCOPE_SELECTOR}`

/**
 * The declarations inside a single-level CSS block, with the selector (or
 * at-rule) and its braces stripped.
 *
 * The token blocks in `default-theme-layer.ts` are the source of truth and are
 * re-emitted here verbatim under a different selector; deriving the body from
 * the shipped constant is what keeps the two from drifting apart, which a
 * hand-copied duplicate could not.
 *
 * ─── IT IS ONLY SOUND FOR A FLAT DECLARATION LIST ──────────────────────────
 *
 * A block containing a nested block would be sliced into unbalanced braces, and
 * a stylesheet that does not parse is a page that renders unstyled. The
 * invariant is enforced by the co-located test rather than by a runtime throw:
 * every block this module scopes is a compile-time constant, so nesting one is
 * something a REVIEWER can be shown and a running server cannot fix. Failing
 * the build is strictly better than failing the boot.
 */
export const blockBody = (block: string): string =>
  block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'))

/** Wrap declaration bodies in one rule, or return `''` when they are all empty. */
const rule = (selector: string, bodies: readonly string[]): string => {
  const declarations = bodies.filter((body) => body.trim() !== '')
  if (declarations.length === 0) return ''
  return `${selector} {${declarations.join('\n')}\n  }`
}

/**
 * The operator's OWN token declarations, as a plain declaration list rather
 * than the `@theme static` block the global path uses.
 *
 * `@theme` is not an option here: Tailwind hoists it to `:root`, which is the
 * document the scope exists to stay out of. The declarations are emitted after
 * the platform tier in the SAME rule, so a duplicated property resolves to the
 * operator's by ordinary "later wins" order.
 *
 * ─── WHAT THIS DELIBERATELY CANNOT DO ──────────────────────────────────────
 *
 * A `--color-*` name only mints a `bg-*`/`text-*` UTILITY when it is REGISTERED
 * in a `@theme` block, and registering the operator's names would hoist them to
 * `:root`. So an operator colour with no platform role slot (`secondary`,
 * `accent`) gets its variable inside the scope but no utility to read it. Role
 * colours are unaffected — every one of them is already registered by the
 * platform layer, which is the whole point of the alias tier.
 *
 * `breakpoints` are omitted for a harder reason: they drive `@media` queries,
 * and a media query is a property of the VIEWPORT, not of a subtree. There is
 * no scoped form of it.
 */
const scopedAuthorTokens = (design?: Design): string =>
  [
    generateThemeColors(design?.colors),
    generateThemeFonts(design?.typeScale?.families),
    generateSpacingScale(design?.spacing),
    generateThemeShadows(design?.elevation),
    generateThemeBorderRadius(design?.radius),
    generateThemeTypeScale(design?.typeScale?.steps),
    generateMotionScale(design?.motion),
  ]
    .filter(Boolean)
    .join('\n')

/** Everything one scoped design system is built from. */
export interface ScopedThemeLayerInput {
  /** The design the scoped subtree resolves — the operator's, not the host's. */
  readonly design?: Design
  /** Defaults to {@link DESIGN_SCOPE_SELECTOR}; parameterised for testability. */
  readonly selector?: string
  /** Defaults to {@link DESIGN_SCOPE_DARK_SELECTOR}. */
  readonly darkSelector?: string
}

/**
 * Emit one design system under a selector: the platform token layer, then the
 * operator's overrides, then both dark arms.
 *
 * @param input - the scoped design and the selectors to emit it under.
 * @returns the scoped CSS, or `''` when there is nothing to scope.
 */
export const scopedTokenLayer = ({
  design,
  selector = DESIGN_SCOPE_SELECTOR,
  darkSelector = DESIGN_SCOPE_DARK_SELECTOR,
}: ScopedThemeLayerInput): string => {
  // `baseline: 'replace'` swaps the platform floor for the grayscale one,
  // exactly as `buildDefaultLayer` does globally. A scope that ignored it would
  // document an app in a baseline the app does not ship.
  const replaced = design?.baseline === 'replace'
  const light = replaced ? NEUTRAL_FLOOR_ROOT_LIGHT : V1_ROOT_LIGHT
  const dark = replaced ? NEUTRAL_FLOOR_ROOT_DARK : V1_ROOT_DARK

  return [
    rule(selector, [
      // TIER 1 + 4 — the ramps, and `color-scheme`.
      blockBody(light),
      // TIER 2 — the role vars.
      blockBody(ROLE_TOKEN_BRIDGE),
      // TIER 3 — the aliases every Tailwind utility actually reads. Without
      // this the two tiers above read back correctly and paint nothing.
      blockBody(V1_THEME_COLOR_REGISTRATIONS),
      // The operator's own values, last, so they win on source order.
      scopedAuthorTokens(design),
    ]),
    generateAuthorSvBridge(design?.colors, selector),
    rule(darkSelector, [blockBody(dark)]),
    generateDarkColorOverrides(design?.darkColors, darkSelector),
  ]
    .filter(Boolean)
    .join('\n\n  ')
}
