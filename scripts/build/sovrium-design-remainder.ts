/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Sovrium remainder of the default design: what the shadcn/ui registry
 * snapshot does not declare, and what the recipes not yet ported to shadcn's
 * anatomy still read. TEMPORARY, every part of it.
 *
 * [internal ref] makes shadcn/ui's registry the token source: the colour variables
 * (light and dark), `--radius` and its ladder, and the Geist font families
 * come from `[internal ref]`, read by
 * `shadcn-registry-to-design-source.ts`. That module completes THIS object
 * into the typed source `generate-default-design.ts` derives its five files
 * from. Nothing here duplicates a value the snapshot declares: a Sovrium role
 * with a shadcn counterpart is not declared at all, and since P10 not emitted
 * either — its readers name the shadcn variable (`--background`, `--primary`,
 * `--chart-1` …) directly.
 *
 * What remains, and when it leaves:
 *
 * | Part | Read by | Leaves with |
 * |---|---|---|
 * | the neutral and semantic ramps, the roles with no shadcn twin (`bg-inset`, `fg-subtle`, `primary-hover`, the status roles) | recipes through `withVarFallback('sv-…')`, the `--color-*` utilities | each family's port; the last of them in P10 (plan §6.5) |
 * | the type ladder, spacing, line-heights, weights, tracking, shadows | recipes, the `text-*` rungs Tailwind has no name for (`2xs`, `md`) | the family ports, which move onto Tailwind's and base-nova's own scales |
 * | the density ladder | `design.density`, the density-aware recipes | its port (shadcn has no density) |
 * | durations and easings | one recipe (`specialty-ssr-default-classes.ts`) | that recipe's port: the token flip never rides a recipe port (plan §9.4) |
 * | `REMAINDER_RADII` (`none`, `base`, `full`) | the control recipes | their port onto shadcn's ladder |
 * | the neutral floor (`baseline: 'replace'`) scales | the replaced baseline | P10 |
 * | the safelist, the `TOKENS` catalogue order, the inherited projection | the CSS compiler, the islands, the console | P10 |
 *
 * Regenerate after ANY edit: `bun run build:default-design`.
 */

import {
  REMAINDER_COLOR_REGISTRATIONS,
  REMAINDER_FLOOR_DARK,
  REMAINDER_FLOOR_LIGHT,
  REMAINDER_ROLE_BRIDGE,
  REMAINDER_V1_DARK,
  REMAINDER_V1_LIGHT,
} from './sovrium-design-remainder-blocks'
import {
  CANONICAL_COLOR_UTILITIES,
  CANONICAL_FONT_UTILITIES,
  INHERITED,
  LEGACY_ALIASES,
  TOKEN_CATALOGUE,
} from './sovrium-design-remainder-views'
import type {
  DesignRemainder,
  DensityStep,
  OrderedScale,
  Scale,
  TokenBlock,
} from './design-source-types'
import type { Design as DesignConfig } from '@/domain/models/app'

/* ─────────────── the sub-objects that survive a `Design` round trip ─────── */

type DesignTokens = DesignConfig

/**
 * The radius steps shadcn/ui's ladder does not name. `sm`…`4xl` come from the
 * snapshot's `--radius` (see `SHADCN_RADIUS_LADDER`); these three are the
 * Sovrium spellings recipes still read: `none` and `full` are the two ends,
 * and `base` is the 4px step the control recipes use until their family port
 * moves them onto shadcn's ladder. Round-trip proven: `design.radius` accepts
 * and preserves each key.
 */
export const REMAINDER_RADII = {
  none: '0px',
  base: '4px',
  full: '9999px',
} as const satisfies NonNullable<DesignTokens['radius']>

/**
 * The elevation ramp — FOUR levels, each naming a thing that floats.
 *
 * A shadow is spent only where something genuinely leaves the page, and the
 * system admits three such things: a menu, a dialog, and the switch thumb.
 * Everything else is bounded by a border, which states an edge more honestly
 * than a blur does. So the ramp is `none` plus one level per floating thing,
 * and a level with no floating thing to name does not exist.
 *
 * Two steps were retired on 2026-09-08 for failing that test:
 *
 * - `xs` (`0 1px 0 0 rgb(0 0 0 / 0.04)`) was a hairline pretending to be
 *   elevation. At zero blur and 4% it IS a 1px rule, drawn in the wrong
 *   medium — a `border` renders the same intent, snaps to the device pixel,
 *   and survives a background change. The field affordances that spent it
 *   carry their border alone.
 * - `xl` (`0 24px 48px -8px …`) was elevation above the dialog, and nothing in
 *   the system sits above a dialog. Toasts, its only plausible tenant, share
 *   the dialog plane and are told apart by their ink ground rather than by
 *   24px of extra blur. Its consumers moved to `lg`.
 *
 * The three surviving values are single-layer. The retired ramp doubled every
 * shadow — a wide soft layer plus a tight dark one — for a contact-shadow
 * effect that is invisible at 12px blur and 6% opacity, and paid two paint
 * passes for it on every open menu.
 */
export const DEFAULT_SHADOWS = {
  none: 'none',
  /** The switch thumb — the one 1px lift the system admits. */
  sm: '0 1px 2px rgb(0 0 0 / 0.08)',
  /** Menus, popovers, hover cards: floating, but anchored to a trigger. */
  md: '0 4px 12px rgb(0 0 0 / 0.06)',
  /** Dialogs, drawers, toasts: floating free of the page. */
  lg: '0 8px 24px rgb(0 0 0 / 0.12)',
} as const satisfies NonNullable<DesignTokens['elevation']>

/**
 * The font slot shadcn/ui does not declare: `display` follows the sans stack.
 * `sans` and `mono` come from the snapshot (`font-geist.json` and the
 * `font-geist-mono` registry item).
 */
const REMAINDER_FONT_FAMILIES = {
  display: { family: 'var(--font-sans)' },
} as const satisfies NonNullable<NonNullable<DesignTokens['typeScale']>['families']>

/**
 * The density ladder. Round-trip proven, and the second-strongest `satisfies`
 * here: `DensityStepSchema` requires all five of `rowY` / `controlH` /
 * `buttonH` / `gap` / `text`, so a dropped key is a type error rather than a
 * silently thinner step.
 *
 * `compact` IS the `:root` default and its `rowY` / `gap` / `text` ARE the
 * literals the recipes used to hard-code (`py-[5px]`, `text-[11px]`,
 * `px-[7px]`), so those three must not move without a visual review.
 *
 * ## Why `controlH` and `buttonH` are two numbers
 *
 * They were one, at 28px, and that conflation made a field height
 * unadjustable. A text field and a small button are both "inline controls"
 * only in the sense that they sit on a line: a field is a place to TYPE and
 * wants room for a cursor, a descender and a comfortable click target, while a
 * small button is a label with a box drawn round it and wants to disappear
 * into a toolbar. The reference drawings put them 8px apart — field 36, small
 * button 28 — and under one key no density step could move either without
 * moving both.
 *
 * The ladder therefore carries both, and both ascend: fields 36 / 40 / 44,
 * buttons 28 / 32 / 36. `roomy`'s field lands exactly on the 44px WCAG 2.2
 * §2.5.8 enhanced target ({@link DENSITY_FLOORS.hit}), which is what a loose
 * step is for.
 */
export const DEFAULT_DENSITY = {
  steps: {
    compact: { rowY: '5px', controlH: '36px', buttonH: '28px', gap: '7px', text: '11px' },
    cozy: { rowY: '8px', controlH: '40px', buttonH: '32px', gap: '10px', text: '13px' },
    roomy: { rowY: '14px', controlH: '44px', buttonH: '36px', gap: '16px', text: '14px' },
  },
} as const satisfies NonNullable<DesignConfig['density']>

/* ───────────── scales with no `Design` home (see the docstring) ─────────── */

/**
 * The `2xs`…`6xl` platform font-size ladder, registered into Tailwind's
 * `--text-*` namespace. `typeScale.steps` is a separate, closed 12-step Struct
 * carrying an app's own SEMANTIC ladder (`display`…`overline`); the two never
 * collide, because their rung names are disjoint.
 *
 * ─── WHY `--text-*` AND NOT `--font-size-*` ─────────────────────────────────
 *
 * Until 2026-09-09 this ladder emitted `--font-size-*`, which is not a Tailwind
 * v4 namespace and which therefore **no utility ever read**. `text-base`
 * resolved to Tailwind's own `--text-base: 1rem`, so a `<p>` rendered at 16px
 * however this block was written, and the recipes reached the ladder only
 * through three hand-copied rem LITERALS that a unit test had to pin in place.
 * Measured on the served stylesheet: `--font-size-*` appeared in the generated
 * theme layer and in ZERO served declarations, because a plain `@theme` block
 * is candidate-gated and no candidate referenced it.
 *
 * Emitting `--text-*` is what makes a rung real — it populates `:root` AND backs
 * the `text-{rung}` utility — so a recipe names `text-base` instead of copying
 * `0.8125rem`, and the three pinned literals, with the test and the console
 * disclosure that existed to apologise for them, are gone.
 *
 * ─── WHY THESE VALUES ───────────────────────────────────────────────────────
 *
 * `base` is 13px: the platform base type step, per the design-console canvas.
 * Every other rung follows from it, and the set is exactly the canvas' own, so
 * each canvas size lands ON a named rung rather than between two:
 *
 *   xs 11 badge · th · eyebrow       sm 12 td · caption · rail
 *   base 13 button · input · deck    md 14 body · nav · large button
 *   lg 16 h4                         xl 18 lead
 *   2xl 20 h3 · 3xl 24 h2 · 4xl 30 h1 · 5xl 40 display
 *
 * `sm` < `base` < `md` now holds, which it did not while `base` was 14px and
 * `sm` 13px — the inversion that blocked this change when it was first drafted.
 *
 * Consequence, stated rather than left to be discovered: this moves every plain
 * `text-*` class in the repo one rung tighter. That is the intended systemic
 * tightening, not a side effect — the canvas reads one notch tighter than the
 * shipped UI did.
 */
const FONT_SIZES = {
  '2xs': '0.625rem',
  xs: '0.6875rem',
  sm: '0.75rem',
  base: '0.8125rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1.125rem',
  '2xl': '1.25rem',
  '3xl': '1.5rem',
  '4xl': '1.875rem',
  '5xl': '2.5rem',
  '6xl': '3rem',
} as const satisfies Scale

/**
 * The leading paired with each rung, emitted as `--text-{rung}--line-height`.
 *
 * Emitted rather than inherited, for a discontinuity rather than a preference.
 * Tailwind ships a `--text-{rung}--line-height` modifier for its OWN rungs
 * only, spelled `calc(<leading-rem> / <size-rem>)` so leading lands on the 4px
 * grid. Redeclaring a size without its modifier leaves the stale ratio in place
 * — and, worse, `2xs` and `md` are rungs Tailwind does not have at all, so they
 * would fall through to the browser's `normal` (~1.2) while every rung either
 * side of them sat at 1.4–1.55. `md` is the canvas' BODY size, so that gap would
 * land on the most-used rung in the ladder.
 *
 * Each value re-snaps its rung to the 4px grid at the new size. The `calc(a/b)`
 * spelling is Tailwind's own, kept because it makes the target readable: the
 * numerator is the leading in rem, the denominator the size.
 */
const FONT_SIZE_LEADINGS = {
  '2xs': 'calc(0.875 / 0.625)',
  xs: 'calc(1 / 0.6875)',
  sm: 'calc(1.125 / 0.75)',
  base: 'calc(1.25 / 0.8125)',
  md: 'calc(1.375 / 0.875)',
  lg: 'calc(1.5 / 1)',
  xl: 'calc(1.75 / 1.125)',
  '2xl': 'calc(1.75 / 1.25)',
  '3xl': 'calc(2 / 1.5)',
  '4xl': 'calc(2.25 / 1.875)',
  '5xl': '1',
  '6xl': '1',
} as const satisfies Scale

/** The four weights. No `Design` home at all. */
const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Scale

/** The five line-heights. No `Design` home (`typeScale` is per-STEP). */
const LINE_HEIGHTS = {
  none: '1',
  tight: '1.1',
  snug: '1.25',
  normal: '1.55',
  relaxed: '1.7',
} as const satisfies Scale

/** The five tracking steps. No `Design` home. */
const LETTER_SPACINGS = {
  tighter: '-0.022em',
  tight: '-0.012em',
  normal: '0',
  wide: '0.02em',
  caps: '0.04em',
} as const satisfies Scale

/**
 * The spacing scale, as an ORDERED list rather than a record.
 *
 * A record cannot carry this scale. Its keys (`0`, `1`, `2`, …) are
 * integer-like, and JavaScript hoists integer-like keys to the front of a plain
 * object in ascending numeric order regardless of insertion order — so
 * `{ '0': …, px: …, '0-5': …, '1': … }` iterates as 0, 1, 2, … then px, 0-5,
 * 1-5, 2-5, and the emitted CSS silently reorders. Caught by the byte-identity
 * comparison against the hand-written layer; a record would have shipped a
 * reordered block that still compiled.
 *
 * Also: `theme.spacing` is NOT a home for this — its key pattern matches no
 * digit, so `Schema.Record` drops every key here (see the file docstring).
 */
const SPACINGS = [
  ['0', '0px'],
  ['px', '1px'],
  ['0-5', '0.125rem'],
  ['1', '0.25rem'],
  ['1-5', '0.375rem'],
  ['2', '0.5rem'],
  ['2-5', '0.625rem'],
  ['3', '0.75rem'],
  ['4', '1rem'],
  ['5', '1.25rem'],
  ['6', '1.5rem'],
  ['8', '2rem'],
  ['10', '2.5rem'],
  ['12', '3rem'],
  ['16', '4rem'],
  ['20', '5rem'],
  ['24', '6rem'],
  ['32', '8rem'],
] as const satisfies OrderedScale

/**
 * THREE durations, paired one-to-one with the three curves below.
 *
 * `instant: 0ms` and `deliberate: 340ms` were retired on 2026-09-08. Neither
 * had a consumer anywhere in `src/`, and neither could earn one: `0ms` is the
 * absence of a transition, which is spelled by not declaring one, and 340ms is
 * past the point where a UI transition stops reading as motion and starts
 * reading as lag.
 */
const DURATIONS = {
  /** Leaving: dialogs, drawers and toasts dismissing. Pairs with `exit`. */
  fast: '120ms',
  /** The default: hover, selection, a tab underline sliding. Pairs with `default`. */
  base: '180ms',
  /** Arriving: dialogs, drawers, menus and accordion panels opening. Pairs with `enter`. */
  slow: '260ms',
} as const satisfies Scale

/**
 * THREE easing curves, one per phase: steady, arriving, leaving.
 *
 * `emphasized` (`cubic-bezier(0.3, 0, 0.1, 1.1)`) was retired on 2026-09-08.
 * Its terminal `1.1` overshoots — the curve exists to make a thing bounce past
 * its resting position — and nothing in the system bounces. It had no consumer
 * in `src/`.
 */
const EASINGS = {
  /** Symmetric. Anything that changes state in place. */
  default: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Decelerating. Anything appearing: it arrives fast and settles. */
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Accelerating. Anything leaving: it commits immediately and is gone. */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const satisfies Scale

/** The neutral floor's line-heights — the one scale it does NOT share with v1. */
const NEUTRAL_FLOOR_LINE_HEIGHTS = {
  none: '1',
  tight: '1.1',
  snug: '1.25',
  normal: '1.5',
  relaxed: '1.625',
} as const satisfies Scale

/** The neutral floor's system font stacks. */
const NEUTRAL_FLOOR_FONT_FAMILIES = {
  sans: {
    family: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  mono: { family: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  display: { family: 'var(--font-sans)' },
} as const satisfies NonNullable<NonNullable<DesignTokens['typeScale']>['families']>

/* ───────────────── derivations, so a value is written exactly once ─────── */

/**
 * The four declarations of one density step.
 *
 * Written as a derivation rather than as four literals in the block, because
 * the block and {@link DEFAULT_DENSITY} would otherwise be two copies of the
 * same numbers — the precise defect this whole file exists to remove. `knip`
 * caught it: the `satisfies`-checked object was exported and unused while the
 * block carried the values.
 */
const densityBlock = (selector: string, step: DensityStep): TokenBlock => ({
  selector,
  items: [
    { kind: 'decl', property: '--sv-density-row-y', value: step.rowY },
    { kind: 'decl', property: '--sv-density-control-h', value: step.controlH },
    { kind: 'decl', property: '--sv-density-button-h', value: step.buttonH },
    { kind: 'decl', property: '--sv-density-gap', value: step.gap },
    { kind: 'decl', property: '--sv-density-text', value: step.text },
  ],
})

export const SOVRIUM_DESIGN_REMAINDER = {
  safelist: {
    colorUtilities: CANONICAL_COLOR_UTILITIES,
    fontUtilities: CANONICAL_FONT_UTILITIES,
  },
  tokenCatalogue: TOKEN_CATALOGUE,
  colorRegistrations: REMAINDER_COLOR_REGISTRATIONS,
  scales: {
    fontFamilies: REMAINDER_FONT_FAMILIES,
    fontSizes: FONT_SIZES,
    fontSizeLeadings: FONT_SIZE_LEADINGS,
    fontWeights: FONT_WEIGHTS,
    lineHeights: LINE_HEIGHTS,
    letterSpacings: LETTER_SPACINGS,
    spacings: SPACINGS,
    radii: REMAINDER_RADII,
    shadows: DEFAULT_SHADOWS,
    durations: DURATIONS,
    easings: EASINGS,
  },
  v1: {
    light: REMAINDER_V1_LIGHT,
    dark: REMAINDER_V1_DARK,
  },
  roleBridge: REMAINDER_ROLE_BRIDGE,
  density: {
    root: densityBlock(':root', DEFAULT_DENSITY.steps.compact),
    steps: [
      densityBlock("[data-density='cozy']", DEFAULT_DENSITY.steps.cozy),
      densityBlock("[data-density='roomy']", DEFAULT_DENSITY.steps.roomy),
    ],
  },
  neutralFloor: {
    light: REMAINDER_FLOOR_LIGHT,
    dark: REMAINDER_FLOOR_DARK,
    scales: {
      fontFamilies: NEUTRAL_FLOOR_FONT_FAMILIES,
      fontSizes: FONT_SIZES,
      fontSizeLeadings: FONT_SIZE_LEADINGS,
      fontWeights: FONT_WEIGHTS,
      lineHeights: NEUTRAL_FLOOR_LINE_HEIGHTS,
      radii: REMAINDER_RADII,
      shadows: DEFAULT_SHADOWS,
    },
  },
  legacyAliases: LEGACY_ALIASES,
  inherited: INHERITED,
} as const satisfies DesignRemainder
