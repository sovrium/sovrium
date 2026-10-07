/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseEcoDesignLayer } from '@/domain/models/process-env/eco/eco-design-layer'
import { getDesignSystemScope } from '@/infrastructure/css/design-system-scope'
import { generateMotionStyles } from '@/infrastructure/css/styles/animation-styles-generator'
import {
  generateComponentsLayer,
  generateUtilitiesLayer,
} from '@/infrastructure/css/styles/component-layer-generators'
import { generateMarqueeStyles } from '@/infrastructure/css/styles/marquee-styles-generator'
import { generateCalendarStyles } from '@/infrastructure/css/theme/calendar-styles'
import { generateCodeBlockStyles } from '@/infrastructure/css/theme/code-block-styles-generator'
import { generateCommandPaletteStyles } from '@/infrastructure/css/theme/command-palette-styles'
import {
  NEUTRAL_FLOOR_LAYER,
  ROLE_TOKEN_BRIDGE,
  V1_THEME_REGISTRATIONS,
  V1_TOKEN_LAYER,
} from '@/infrastructure/css/theme/default-theme-layer'
import { SELF_HOSTED_FONT_FACES } from '@/infrastructure/css/theme/fonts'
import { generateRichTextStyles } from '@/infrastructure/css/theme/rich-text-styles'
import { scopedTokenLayer } from '@/infrastructure/css/theme/scoped-theme-layer'
import {
  generateAuthorSvBridge,
  generateDarkColorOverrides,
  generateDensityLayer,
  generateMotionScale,
  generateSpacingScale,
  generateThemeBorderRadius,
  generateThemeBreakpoints,
  generateThemeColors,
  generateThemeFonts,
  generateThemeShadows,
  generateThemeTypeScale,
} from '@/infrastructure/css/theme/theme-generators'
import { generateBaseLayer } from '@/infrastructure/css/theme/theme-layer-generators'
import { STATIC_IMPORTS } from './source-css-head'
import type { App } from '@/domain/models/app'
import type { Design } from '@/domain/models/app/design'

/**
 * The dynamic source CSS the compiler hands to either engine: the app's own
 * `@theme` tokens and every layer laid around them, in source order.
 */

/**
 * Generate the complete Tailwind `@theme` block from `app.design`.
 *
 * ## One parameter, because there is one position
 *
 * Every token family lives under the one `design` key, so the guard is simply
 * `!design`: there is no second container that could hold a declared token
 * while this one is absent. Two parameters for one design system — a token
 * block beside a type ladder — would need a guard over both halves, and an early
 * return on the wrong one would make every declared step silently emit nothing.
 * One position leaves that class of bug (a key declared in the position the
 * reader did not check) no place to happen.
 *
 * ## Emission order
 *
 * The first seven emitters keep their exact previous order, and
 * `generateMotionScale` is APPENDED rather than slotted in beside its ladder
 * siblings. That is deliberate: motion is the one token family that emitted
 * nothing before, so appending it leaves the stylesheet of every app that
 * declares no `motion` byte-identical to what it was under `theme.*`.
 */
function generateDesignCSS(design?: Design): string {
  if (!design) return ''

  // Narrow ONCE rather than optional-chaining each generator: every `Design`
  // field is itself optional, so an empty object is a faithful stand-in for
  // "nothing declared" and each generator already guards its own absent input.
  const declared: Design = design

  const themeTokens = [
    generateThemeColors(declared.colors),
    generateThemeFonts(declared.typeScale?.families),
    generateSpacingScale(declared.spacing),
    generateThemeShadows(declared.elevation),
    generateThemeBorderRadius(declared.radius),
    generateThemeBreakpoints(declared.breakpoints),
    generateThemeTypeScale(declared.typeScale?.steps),
    generateMotionScale(declared.motion),
  ].filter(Boolean)

  // The author-`--sv-*` bridge block, emitted as
  // a separate `:root` block AFTER `@theme static`. Each `app.design.colors.X`
  // value also writes `--sv-Y: value` directly so the prestyled-by-default
  // island channel (`bg-[var(--sv-Y, …)]`) picks up tenant overrides in
  // addition to the legacy `bg-X` utility channel. The cascade ordering
  // (ROLE_TOKEN_BRIDGE → author bridge) ensures the tenant value beats the
  // bridge's neutral fallback by ordinary "later wins" cascade semantics. See
  // `generateAuthorSvBridge` for the full rationale.
  const authorSvBridge = generateAuthorSvBridge(declared.colors)

  // `design.darkColors` — the authored dark palette. Emitted LAST so its
  // `html:is(.dark, …)` block sits after both the `@theme static` tokens and
  // the default theme layer's own dark cascade (`V1_ROOT_DARK`), which it ties
  // with on specificity and must therefore beat on source order. See
  // `generateDarkColorOverrides` for the full cascade rationale.
  const darkColorOverrides = generateDarkColorOverrides(declared.darkColors)

  if (themeTokens.length === 0 && !authorSvBridge && !darkColorOverrides) return ''

  // `@theme static` (not plain `@theme`) so author-declared tokens are ALWAYS
  // emitted to :root, even when no candidate references them yet. Plain `@theme`
  // tree-shakes unused tokens — fine for Tailwind's default palette, wrong for an
  // operator's own theme: client-hydrated islands may reference these vars at
  // runtime, beyond the reach of the build-time candidate scan.
  const themeStaticBlock =
    themeTokens.length > 0 ? `@theme static {\n${themeTokens.join('\n')}\n  }` : ''

  return [themeStaticBlock, authorSvBridge, darkColorOverrides].filter(Boolean).join('\n\n')
}

/**
 * Final base layer for global resets
 * Note: Removed hardcoded utilities (border-border, bg-background, etc.)
 * These should be defined in the app theme if needed
 */
const FINAL_BASE_LAYER = ''

/**
 * Build the always-present default token layer (see V1_TOKEN_LAYER in
 * `theme/default-theme-layer.ts`).
 *
 * Selected by `design.baseline`:
 *  - `'replace'` → neutral floor (grayscale, system fonts) + the alias bridge,
 *    so a replaced baseline still defines every canonical token and never
 *    renders unstyled.
 *  - otherwise (default `'extend'`) → the v1 token layer + the alias bridge.
 *
 * The alias bridge supplies the role-token LIGHT values via
 * `author key → legacy → default` fallback chains, late-bound so the author's
 * `@theme` (emitted later in `buildSourceCSS`) still wins.
 *
 * Injected in `buildSourceCSS` between `STATIC_IMPORTS` and the base layer so it
 * flows through BOTH the native PostCSS path and the native-free binary path.
 */
function buildDefaultLayer(design?: Design): string {
  // ECO_DESIGN_LAYER=off — operator demotes the token layer's OVERRIDE SURFACE
  // (the design-layer contract). The prestyled-by-default islands carry their own OKLCH /
  // radius / shadow defaults inline via `withVarFallback`, so the page still
  // renders styled. We still emit the `@theme` token REGISTRATIONS
  // (`V1_THEME_REGISTRATIONS`) — they mint the canonical `bg-*` / `text-*` /
  // `border-*` / `ring-*` / `font-*` / `text-{size}` utilities that
  // `generateBaseLayer` `@apply`s (e.g. `@apply text-foreground`, `font-sans`).
  // Without them the per-app PostCSS/native-free compile THROWS "Cannot apply
  // unknown utility class `text-foreground`", which previously forced the
  // layer-off path to reuse the app-agnostic pre-compiled file — breaking the
  // with≡without parity for apps that author classes outside the builtin scan
  // (border resolved to the bare-`border`/red-600 fallback instead of the
  // canonical token). Dropping only the VALUE blocks (`V1_ROOT_*` / the alias
  // bridge) keeps the override surface demoted while letting layer-off compile
  // per-app exactly like layer-on. The self-hosted `@font-face` blocks stay so
  // text still resolves to Plex Sans / JetBrains Mono (part of the prestyled
  // baseline, not the override layer). Verified by
  // `[internal ref]` — the resolved
  // computed styles with the layer disabled must equal the layer-on reading.
  if (parseEcoDesignLayer(process.env) === 'off') {
    return `${SELF_HOSTED_FONT_FACES}\n\n  ${V1_THEME_REGISTRATIONS}`
  }
  const tokenLayer = design?.baseline === 'replace' ? NEUTRAL_FLOOR_LAYER : V1_TOKEN_LAYER
  // Emit `@font-face` BEFORE the token layer so the variable face is registered
  // before the font tokens reference them. Inlined here
  // (not in V1_TOKEN_LAYER) so the token layer remains a pure token block and
  // the existing "excludes @font-face" contract on V1_TOKEN_LAYER still holds.
  return `${SELF_HOSTED_FONT_FACES}\n\n  ${tokenLayer}\n\n  ${ROLE_TOKEN_BRIDGE}`
}

/**
 * Build the dynamic SOURCE_CSS: the app's own `@theme` tokens plus every
 * layer laid around them.
 *
 * Takes the whole `App` rather than a parameter per key: the theme, the type
 * scale, the scope and the density are all derived from the same object at the
 * single call site, so an argument list would only restate it. `design.density` is emitted
 * OUTSIDE `generateDesignCSS` because it is not a `@theme` token at all: it is
 * a `:root` + `[data-density]` block pair, and folding it into the theme
 * generator would put it inside `@theme static`, where the four
 * `--sv-density-*` names would be misread as utility-minting tokens.
 */
export function buildSourceCSS(app?: App, darkPalette: readonly string[] = []): string {
  const design = app?.design
  const scope = getDesignSystemScope(app)
  const themeCSS = generateDesignCSS(design)
  // The author's density ladder. Emitted after `buildDefaultLayer` (below) so
  // its `:root` block beats the platform's `V1_DENSITY_LAYER` on source order —
  // the same same-specificity, later-wins contract the author `--sv-*` colour
  // bridge relies on.
  const densityCSS = generateDensityLayer(app?.design?.density)
  // The SCOPED design system, emitted LAST so its selector-bound blocks sit
  // after every `:root` block the pipeline produces. Source order is not what
  // makes it win — a declaration on an element always beats an inherited value
  // — but emitting it last keeps the stylesheet readable as "the host, then the
  // guest" and leaves no doubt for a future reader.
  const scopedCSS = scope === undefined ? '' : scopedTokenLayer({ design: scope.design })
  const animationCSS = generateMotionStyles(design?.motion, design)
  const defaultLayerCSS = buildDefaultLayer(design)
  const baseLayerCSS = generateBaseLayer(design)
  const componentsLayerCSS = generateComponentsLayer()
  const utilitiesLayerCSS = generateUtilitiesLayer()
  // Code-block chrome (and `.tok-XXX` token color rules) for markdown pages.
  // Plain CSS — flows through BOTH the native PostCSS pipeline AND the
  // pure-JS native-free engine because `buildSourceCSS` is the shared input.
  const codeBlockCSS = generateCodeBlockStyles(design, darkPalette)
  // Marquee band chrome + motion. Plain CSS for the same reason as the code-block
  // rules above: `@keyframes`, `animation-play-state` under `:hover`/`:focus-within`
  // and a `prefers-reduced-motion` override are not utility-shaped, so they must
  // not depend on the Tailwind candidate scan.
  const marqueeCSS = generateMarqueeStyles()
  // FullCalendar theming: the `--fc-*` → `--sv-*` bridge plus the `.fc-*`
  // geometry. Plain CSS for a THIRD reason on top of the two above — the
  // selectors belong to FullCalendar's DOM, not to ours, so the candidate-driven
  // compiler could never mint them as utilities however the corpus grew.
  const calendarCSS = generateCalendarStyles()
  // The command palette, its record-creation dialog and its toast. Plain CSS for
  // the third reason too: that DOM is built by a runtime STRING with no class
  // attribute to hang a utility on, and its keyboard mark is a `[data-active]`
  // state selector an inline style cannot express.
  const commandPaletteCSS = generateCommandPaletteStyles()
  return [
    STATIC_IMPORTS,
    defaultLayerCSS,
    densityCSS,
    baseLayerCSS,
    componentsLayerCSS,
    utilitiesLayerCSS,
    '/*---break---\n     */',
    themeCSS,
    '/*---break---\n     */',
    animationCSS,
    '/*---break---\n     */',
    codeBlockCSS,
    '/*---break---\n     */',
    marqueeCSS,
    '/*---break---\n     */',
    calendarCSS,
    '/*---break---\n     */',
    commandPaletteCSS,
    '/*---break---\n     */',
    // The `.rte` content block — descendant rules over markup the AUTHOR types.
    // Shares the separator above rather than adding a sixth, which would change
    // the compiled output every app is served.
    generateRichTextStyles(),
    scopedCSS,
    '/*---break---\n     */',
    FINAL_BASE_LAYER,
  ]
    .filter(Boolean)
    .join('\n\n    ')
}
