/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the layout-cluster components
 * `card` (the canonical surface chip) and `divider` (in both bare
 * and labeled-separator modes). Schema authors who write the bare
 * `{ type: 'card' }` or `{ type: 'divider', label: 'Section' }` get a
 * complete, opinionated surface — bg + border + shadow + radius + padding
 * for the card; tone-aligned rule + muted-fg label for the divider — with
 * zero theme-layer dependency.
 *
 * The recipe mirrors the buttons + inputs + selects + toggles + numeric +
 * date + overlays + disclosure + feedback + navigation slices (commits
 * 02b2f35f3 + 571ae53ce + 5527660bc + 000f835d7 + 386e9dc35 + 3d35fad9a +
 * 0de6ded2a + 1b3f551a7 + e7e4e4421 + dd831e792). Layout / spacing classes
 * (`flex items-center`, `gap-2`, `p-4`), structural classes (`flex-1`,
 * `select-none`), and `aria-*` attributes stay raw — they encode behavior,
 * not color — while every colour is a shadcn role utility and every radius
 * or shadow class goes through {@link withVarFallback}, so `app.design.*`
 * overrides still win at the CSS cascade layer (the variable first, the
 * inline literal as its fallback).
 *
 * Subparts covered:
 *
 *   - CARD                   — moved onto shadcn/ui's anatomy in
 *                              `card-default-classes.ts`
 *   - DIVIDER (rule)         — the bare `<hr>` rendering; border color
 *                              tracks `border` so it reads as passive
 *                              chrome regardless of light / dark mode
 *   - DIVIDER (label wrapper)— labeled-separator's `<div role="separator">`
 *                              wrapper — flex layout + small muted-fg text;
 *                              kept here so the fixture-painting "labeled
 *                              hr with caption" pattern flows through the
 *                              same token stack
 *   - DIVIDER (label text)   — the `<span>` between the two `<hr>` halves
 *                              of a labeled divider; subtle-fg tone so the
 *                              label reads as chrome, not focal content
 *
 * Intentionally NOT covered (this slice ships smaller than buttons /
 * overlays on purpose — layout primitives without visible chrome don't
 * benefit from baked-in defaults):
 *
 *   - `flex` / `grid` — invisible containers; their
 *      only "design" is the gap / col-count flowing from author props.
 *      Adding default classes would lock authors into a specific gap that
 *      they'd always override, so they stay pure pass-throughs.
 *   - `container` — used both as a structural wrapper AND a painted surface
 *      in the existing fixtures. Painting the wrapper by default would
 *      regress the wrapper use case; the painted-surface use case is what
 *      `card` is for. Stays a pass-through; authors who need a painted
 *      container reach for `card`.
 *   - `spacer` — its `size` axis already drives `h-2 / h-6 / h-12 / h-20`
 *      directly in the renderer. No color / border / shadow surface to
 *      tokenize.
 *   - `sidebar` / `modal` / `tab-panel` — not exercised by the
 *      `ui-kit-layout` cluster fixture; will be covered by the higher-level
 *      "scenes" slice that paints whole page templates rather than this
 *      foundations cluster.
 *
 * Helper file lives in `src/presentation/ui/sections/renderers/element-
 * renderers/` (alongside the renderers that consume it) because all of
 * these surfaces are server-rendered as part of the SSR pass — the
 * `presentation-component → presentation-island` layer boundary does not
 * apply since this is purely a same-layer helper. Mirrors the location
 * chosen for `button-default-classes.ts`, `input-default-classes.ts`,
 * `feedback-default-classes.ts`, and `navigation-default-classes.ts`.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Schema-aligned vocabulary for a divider's `style` (CSS `border-style`).
 *
 * @public Schema-aligned vocabulary type exported alongside its sibling
 * default-class maps for type-safe consumption at renderer call sites.
 */
export type DividerStyle = 'solid' | 'dashed' | 'dotted'

// ──────────────────────────────────────────────────────────────────────────────
// SEPARATOR — the rule, and the labelled form around it
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute the className for the `<hr>` of a `separator` (`data-slot="separator"`).
 *
 * shadcn/ui's separator paints a 1px `bg-border` box. Sovrium's draws the
 * `<hr>`'s own top border in shadcn's `border-border` instead, because the
 * schema's `style: dashed | dotted` is an inline `border-style`, and a filled
 * box has no border to dash. The colour is shadcn's; the line is a border.
 */
export const computeDividerRuleClasses = (): string => 'shrink-0 border-border'

/**
 * Compute the className for a vertical `separator`: its left border is the
 * rule, stretched to the height of the row it stands in, as shadcn/ui's
 * vertical Separator is `self-stretch`.
 */
export const computeVerticalDividerRuleClasses = (): string =>
  'shrink-0 self-stretch border-0 border-l border-border'

/**
 * Compute the className for the `role="separator"` wrapper of a labelled
 * separator: a row of rule, label, rule, in the muted ink, so it reads as
 * wayfinding rather than as a heading.
 */
export const computeDividerLabelWrapperClasses = (): string =>
  'flex items-center gap-2 text-xs text-muted-foreground'

/** Compute the className for the label between the two rules. */
export const computeDividerLabelTextClasses = (): string => 'text-muted-foreground select-none'
