/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computer for the layout-cluster components
 *: `card` (the canonical surface chip) and `divider` (in both bare
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
 * not color — while every color / border / radius / shadow class goes
 * through {@link withVarFallback} so `app.design.*` overrides still win at
 * the CSS cascade layer (`var(--sv-X)` resolves the override first, falling
 * back to the inline OKLCH literal).
 *
 * Subparts covered:
 *
 *   - CARD                   — base surface chip used both as a top-level
 *                              "panel" and as a grid cell; bg + border +
 *                              radius + padding + sm shadow give it the
 *                              standalone-content look without requiring
 *                              the fixture author to spell out every chrome
 *                              property in `props.className`
 *   - DIVIDER (rule)         — the bare `<hr>` rendering; border color
 *                              tracks `sv-border` so it reads as passive
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

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

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
// CARD — base surface chip
// ──────────────────────────────────────────────────────────────────────────────

const CARD_LAYOUT = 'p-5 flex flex-col gap-2'

const CARD_SURFACE = [
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  // `shadow-none`, not the `shadow-[var(--shadow-none,none)]` that stood
  // here. Both suppress the legacy `.card` rule's elevation, which is what this
  // recipe means by a flat surface — but the old one did it by ACCIDENT: it set
  // `--tw-shadow: none`, which is valid as a custom property and invalid inside
  // the composed `box-shadow` list, so the property went invalid-at-
  // computed-value-time and fell to its initial value. `shadow-none` suppresses
  // it on purpose (`box-shadow: none !important`, from the utilities layer in
  // `css/styles/component-layer-generators.ts`) and renders identically.
  //
  // A BUTTON must not use this class — see the `SHADOW_FLAT` note in
  // `button-default-classes.ts`. A card is not focusable and has no ring to
  // lose; a button does, and `!important` would swallow it.
  'shadow-none',
].join(' ')

/**
 * Compute the default className for a `<div>`-rendered `card`. Paints a
 * RAISED surface (`sv-bg-raised`) bounded by a border, with `radius-md`
 * rounded corners — the canonical Sovrium content panel.
 *
 * Deliberately shadowless: the card lifts off the page by being lighter than
 * it and by its border, not by a drop shadow. Elevation is reserved for
 * surfaces that genuinely float ABOVE the page (dialog, modal, popover), so
 * spending a shadow on an inline panel would spend the system's strongest
 * depth signal on its least significant use ([internal ref] restraint).
 *
 * Layout (`p-5 flex flex-col gap-2`) gives the card a sensible inner rhythm
 * for the typical "heading + body + actions" composition without forcing
 * the fixture author to spell it out. Author-supplied `props.className` is
 * merged in by the consuming renderer via `resolveClasses` so it overrides whatever the
 * default paints (e.g. a grid cell that swaps `p-5` for `p-3` to read as
 * denser).
 */
export const computeCardClasses = (): string => [CARD_LAYOUT, CARD_SURFACE].join(' ')

// ──────────────────────────────────────────────────────────────────────────────
// DIVIDER — bare rule + labeled wrapper + label text
// ──────────────────────────────────────────────────────────────────────────────

const DIVIDER_RULE_BORDER = `border-[${v('sv-border', T.border)}]`

/**
 * Compute the default className for an `<hr>` rendered by the bare
 * `{ type: 'divider' }` schema. Resolves to a single border-color class
 * driving `sv-border` — the same passive-chrome tone the rest of the design
 * system uses for separators. CSS `border-style` is still applied via the
 * inline `style={{ borderStyle }}` prop by the renderer (mapped from the
 * schema's `style` axis: `'solid' | 'dashed' | 'dotted'`).
 *
 * Note: this helper does NOT take `style` as an argument — the renderer
 * keeps full ownership of inline `style.borderStyle` because the value
 * comes straight from a schema literal and shouldn't go through a token
 * cascade. The helper's job is the COLOR, which IS token-cascadable.
 */
export const computeDividerRuleClasses = (): string => DIVIDER_RULE_BORDER

const DIVIDER_LABEL_WRAPPER_LAYOUT = 'flex items-center gap-2 text-xs'

const DIVIDER_LABEL_WRAPPER_SURFACE = `text-[${v('sv-fg-muted', T.fgMuted)}]`

/**
 * Compute the default className for the `<div role="separator">` wrapper of
 * a labeled divider (when the schema's `label` prop is set). The wrapper
 * itself is a flex row holding `<hr>` + `<span>` + `<hr>`, where the
 * `<hr>`s shrink (`flex-1`) to fill the remaining space on either side of
 * the centered label. Layout (`gap-2 text-xs`) keeps the label visually
 * tied to the rules without crowding them; surface tone (`sv-fg-muted`)
 * makes the whole composition read as passive chrome — labelled separators
 * are wayfinding aids, not focal content.
 */
export const computeDividerLabelWrapperClasses = (): string =>
  [DIVIDER_LABEL_WRAPPER_LAYOUT, DIVIDER_LABEL_WRAPPER_SURFACE].join(' ')

const DIVIDER_LABEL_TEXT = [`text-[${v('sv-fg-subtle', T.fgSubtle)}]`, 'select-none'].join(' ')

/**
 * Compute the default className for the `<span>` between the two `<hr>`
 * halves of a labeled divider. Subtle foreground tone so the label drops
 * back even further than the wrapper's muted tone (creates a slight
 * hierarchy: rule reads stronger than label, both read weaker than body
 * content); `select-none` prevents the label from being captured in a
 * click-drag selection that's actually targeting the body content above
 * or below the divider.
 */
export const computeDividerLabelTextClasses = (): string => DIVIDER_LABEL_TEXT
