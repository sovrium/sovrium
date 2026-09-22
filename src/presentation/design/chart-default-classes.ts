/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default paint declarations for the `chart` data view (wave R-D).
 *
 * The chart view was already the most token-clean of the seven data views; its
 * debt was GEOMETRY, DUPLICATION, and one inverted tooltip. This module is the
 * single place the chart's paint is declared, so the five canvases
 * (`bar-chart`, `line-chart`, `multi-bar-chart`, `multi-line-chart`,
 * `multi-area-chart`), the shared axis primitives, the legend, the tooltip, the
 * loading state and the SSR twin all spend the same values.
 *
 * ## Why this file lives in `presentation/utils/recipes/`
 *
 * The SSR twin — `ui/sections/rendering/component-registry/island-chart-
 * component.tsx` — is a `presentation-component`, and `[internal ref]
 * .ts` forbids that layer importing a `presentation-island`. A recipe both
 * sides need can therefore only live here. This directory is also registered in
 * `RECIPE_DIRS` (`src/infrastructure/css/arbitrary-var-safelist.ts`), so the
 * `v(...)` arbitrary values below reach the compiled stylesheet.
 *
 * ## Class computers vs SVG constants — the split, and why
 *
 * A chart is mostly SVG, and `stroke` / `fill` / `font-size` / `rx` on an SVG
 * node are PRESENTATION ATTRIBUTES, not classes. Routing them through Tailwind
 * (`stroke-[var(--sv-border,…)]`) would buy nothing and cost something: the
 * safelist generator's `CLASS_USE_PATTERN` only recognises a withVarFallback
 * call inside an arbitrary-value bracket in a class position, so every such
 * class would need to survive a corpus regeneration to paint at all. A raw
 * `var(--sv-border,oklch(...))` string handed to an SVG attribute is resolved
 * by the browser directly and needs no safelisting whatsoever.
 *
 * That sentence DESCRIBES the call shape rather than spelling it, deliberately.
 * `Design Token Drift` extracts token names by scanning source text for that
 * call and does not exclude comments, so an illustrative token name in prose
 * here was read as a real recipe spending an undeclared token — and failed the
 * gate twice over, once for having no TOKENS entry and once for never being
 * declared in the design source. Same trap as the Tailwind candidate corpus,
 * which harvests class-shaped tokens out of comments for the same reason: a
 * scanner that reads source as text cannot tell an example from a use.
 *
 * So: DOM parts get `compute<Part>Classes()`; SVG parts get named constants.
 * Both live here, which is the point — there is still ONE place a reader can
 * change the chart's paint.
 *
 * ## Parts
 *
 *   - SHELL       — the `data-component="chart"` card: 1px hair border, 6px
 *                   radius, `raised` surface, 10px/12px inner padding. Its
 *                   BODY (the `ParentSize`-measured interior) is the second
 *                   computer, because the measured element and the framed
 *                   element are not the same node in the multi-series shell.
 *   - LAYOUT      — the flex box inside the card that holds the legend and the
 *                   body. It exists because `legend.position` is a placement:
 *                   its direction and gap ARE the declared value.
 *   - AXIS        — the X/Y baselines and the optional axis TITLE
 *   - TICK        — the X/Y tick labels and their offsets from the baselines
 *   - GRIDLINE    — the horizontal rules drawn when an axis declares `gridLines`
 *   - SERIES MARK — bar radius, line width, line-point ring, area opacity.
 *                   Beyond the seven-part vocabulary, but the CHART target
 *                   table has a row for each and they are paint like the rest;
 *                   leaving them inline would defeat the whole exercise.
 *   - LEGEND      — the `<ul>` strip, on either of its two axes
 *   - LEGENDCHIP  — one clickable series entry, plus its colour swatch
 *   - TOOLTIP     — the in-SVG hover callout
 *
 * ## Type ladder
 *
 * The canvas draws its axis and tick text at **9px**, which has no rung on
 * `PLATFORM_TYPE_LADDER`. Every 9px figure here is therefore taken to the
 * nearest rung, `text-2xs` (10/14) — a deliberate, named +1px divergence,
 * applied uniformly so the chart never mixes two off-ladder sizes. The tooltip's
 * 10px and the legend chip's 11px are exact rungs (`text-2xs`, `text-xs`).
 *
 * ## Colour mapping (wave-level, see the R-D target table §0)
 *
 * canvas `hair` → `sv-border` · `inset` → `sv-bg-inset` · `raised` →
 * `sv-bg-raised` · `ink` → `sv-fg` · `subtle` → `sv-fg-subtle` · `muted` and
 * `prose` → `sv-fg-muted`. The last is the accepted role-over-value divergence
 * R-B already took for the table header; captions render ~0.10 L darker than
 * the drawing, which is named rather than silent.
 *
 * ## Namesake warning
 *
 * `data-default-classes.ts` (the SSR element recipes) also exports a
 * `computeChartShellClasses`. That one paints the design-system reference app's
 * chart SIMULACRUM and is pinned by `data-default-classes.test.ts`; it is a
 * different surface and is deliberately left alone. The LIVE chart view — both
 * its island and its SSR placeholder — spends the one below.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// SHELL (the framed card, and its measured interior)
// ──────────────────────────────────────────────────────────────────────────────

// `relative` is carried here rather than left to the call sites because the two
// definitions it collapses disagreed about it: the shared constant in
// `chart-series-shared.ts` had it, the two LOCAL constants that shadowed it in
// `bar-chart.tsx` and `line-chart.tsx` did not. Nothing in the chart subtree is
// absolutely positioned today (the tooltip is inside the SVG, placed by x/y
// attributes), so `relative` is inert either way — it is kept as the safer
// superset, and so the disagreement cannot come back.
//
// No HEIGHT here, on purpose. EVERY caller measures a separate body that
// resolves its own height ({@link computeChartBodyClasses}) and the card sizes
// to it, or the frame's padding plus the legend overflow the card.
//
// The three single-series canvases used to be the exception: they measured this
// element directly and appended their own `h-80`, which after the 1px border and
// `py-2.5` left a 298px plot where the shell's body measures 288. Two bar charts
// over the same rows at the same width therefore drew plot areas 10px apart —
// a step nobody configured, and visible the moment two charts sat in one column.
// There is now one height in the chart subtree, and it is `CHART_BODY`.
const CHART_SHELL = [
  'relative w-full',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
  // canvas `padding:10px 12px` — vertical first
  'px-3 py-2.5',
].join(' ')

/**
 * Compute the default className for the chart card — the element that carries
 * `data-component="chart"`. 1px hair border on a 6px radius over the `raised`
 * surface, with the canvas' 10px/12px inner padding.
 *
 * It carries NO height and no caller may append one: the element a chart
 * measures is always the body inside it ({@link computeChartBodyClasses}), so
 * that every chart draws the same plot height whichever canvas rendered it.
 */
export const computeChartShellClasses = (): string => CHART_SHELL

const CHART_BODY = 'relative aspect-[2/1] min-h-40 w-full'

// A body sitting BESIDE the legend is a flex item on the main axis, so it must
// claim the leftover width rather than declare its own. `min-w-0` is the
// load-bearing half: without it the item's automatic minimum size is its content
// width, the SVG never yields, and a wide legend pushes the plot out of the card.
const CHART_BODY_BESIDE = 'relative aspect-[2/1] min-h-40 min-w-0 flex-1'

/**
 * Compute the default className for the shell's measured interior — the
 * `ParentSize` parent, inside the multi-series shell AND inside each
 * single-series canvas.
 *
 * The height is RESOLVED rather than free, and that constraint has not moved:
 * `ParentSize` reports zero for a parent whose height is auto, and the SVG then
 * never draws — so letting the body size to its content remains impossible.
 * What has changed is HOW the height is resolved. A fixed pixel height is
 * width-blind: the same 288px box drew a squat letterbox in a wide card and a
 * near-square in a narrow one. A 2:1 aspect ratio over a definite width is just
 * as resolved — the box still has a height before the SVG measures it — while
 * keeping one shape at every width.
 *
 * Both values are measured rather than chosen:
 *
 *  - **2:1** preserves today's reading where charts are actually read. At the
 *    modal desktop width the body is 578px wide (a 1440 viewport), and 2:1
 *    resolves that to 289px against the 288 it drew before — within a pixel.
 *  - **The 160px floor** exists because the vertical chrome (the axis band plus
 *    its tick labels) is a CONSTANT 49px, whatever the height: shrink the box
 *    and the plot area, not the chrome, is what disappears. 160 is the smallest
 *    step at which the drawing area (111px) is more than twice its chrome; the
 *    steps below give 95px (1.9x) and 79px (1.6x), where the axis starts to
 *    outweigh the data it labels. It binds below ~320px of body width, i.e. at
 *    phone widths only — everywhere else the ratio is what decides.
 *
 * This is the ONE height in the chart subtree, and that is the point: a chart's
 * height is not something the operator declares (there is no `height` key on
 * `chart`), so it is the engine's to keep consistent, and a second constant on
 * the other canvas is how two charts over the same rows came to disagree by
 * 10px. [internal ref] pins the invariant.
 *
 * `beside` selects the flex-item form used when the legend is placed to the
 * left or the right; the default is the stacked form, where the body spans the
 * card and the legend sits above or below it.
 */
export const computeChartBodyClasses = ({
  beside = false,
}: {
  beside?: boolean
} = {}): string => (beside ? CHART_BODY_BESIDE : CHART_BODY)

// ──────────────────────────────────────────────────────────────────────────────
// LAYOUT (the box that holds the legend and the body, i.e. `legend.position`)
// ──────────────────────────────────────────────────────────────────────────────

// `legend.position` IS this choice — which side of the plot the strip occupies —
// so it is expressed once, here, as the direction and gap of the flex box
// holding the two. Which of the two comes FIRST stays in the shell, because
// child order is JSX rather than paint.
//
// Canvas gaps: 6px between a stacked legend and the plot, 12px between a side
// legend and the plot — wider, because a horizontal gap has no line-height air
// of its own to borrow.
const CHART_LAYOUT_STACKED = 'flex flex-col gap-1.5'
const CHART_LAYOUT_BESIDE = 'flex flex-row items-start gap-3'

/**
 * Compute the className for the shell's layout box — the flex container holding
 * the legend and the measured body. `beside` is the horizontal form
 * (`legend.position` of `left` or `right`); the default stacks them.
 *
 * It is a box of its own rather than the card itself, because the two
 * single-series canvases use the card as their `ParentSize` parent and a flex
 * display there would change what they measure.
 */
export const computeChartLayoutClasses = ({
  beside = false,
}: {
  beside?: boolean
} = {}): string => (beside ? CHART_LAYOUT_BESIDE : CHART_LAYOUT_STACKED)

// ──────────────────────────────────────────────────────────────────────────────
// AXIS (baselines + optional axis title)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Stroke for the X and Y axis baselines. Canvas `chartSvg` draws
 * `<path d="M{L} {B}H{R}" stroke="#e3e3e3"/>` — the `hair` tone, i.e. the same
 * hairline as the card border, so the frame and the axes read as one chrome
 * weight rather than two.
 *
 * The canvas draws only the X baseline; the shipped charts draw both. The extra
 * Y baseline is kept — it is structure, not paint, and the table's action for
 * this row is "keep; route through the recipe".
 */
export const CHART_AXIS_STROKE = v('sv-border', T.border)

/**
 * Fill for an axis TITLE (`data-chart-axis-title`), the operator-set `xAxis
 * .label` / `yAxis.label`. Canvas draws it at `#707070` — `muted`, one step
 * stronger than a tick, because it names the dimension rather than repeating a
 * value.
 */
export const CHART_AXIS_LABEL_FILL = v('sv-fg-muted', T.fgMuted)

/** Axis-title size. Canvas 9px → the `text-2xs` rung (10/14). */
export const CHART_AXIS_LABEL_FONT_SIZE = 10

/**
 * Axis-title weight, preserved at the shipped 600.
 *
 * The canvas draws no `font-weight` on this node (so, 400), but the CHART
 * target table lists only `type / fill` for the axis-label row. Dropping the
 * weight would be a visible change outside the stated scope, so it is held at
 * its current value and surfaced here rather than left inline — the point of
 * the constant is that flipping it later is a one-line edit in one file.
 */
export const CHART_AXIS_LABEL_FONT_WEIGHT = 600

// ──────────────────────────────────────────────────────────────────────────────
// TICK (X/Y tick labels and their offsets)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fill for X and Y tick labels. Canvas `#a1a1a1` — `subtle`, the faintest
 * live-text tone, because a tick is a reading aid rather than content. This
 * replaces `--color-foreground-muted`, which painted ticks at the same weight
 * as the axis title and flattened the two levels into one.
 */
export const CHART_TICK_FILL = v('sv-fg-subtle', T.fgSubtle)

/** Tick-label size. Canvas 9px → the `text-2xs` rung (10/14); was 11. */
export const CHART_TICK_FONT_SIZE = 10

/**
 * Horizontal gap between a Y tick label's end anchor and the Y baseline.
 * Canvas draws the label at `x = L - 6`; the shipped charts used 8.
 */
export const CHART_Y_TICK_GAP = 6

/**
 * Vertical drop from the X baseline to an X tick label's baseline. Canvas draws
 * it at `y = B + 14`; the shipped charts used 18.
 */
export const CHART_X_TICK_BASELINE_OFFSET = 14

// ──────────────────────────────────────────────────────────────────────────────
// GRIDLINE (horizontal rules, drawn only when an axis declares `gridLines`)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Stroke for the Y-tick-aligned horizontal grid rules. Canvas `#efefef` —
 * `inset`, which is FAINTER than the axis baseline on purpose: a grid that
 * matches the axis weight competes with the data it exists to help read. The
 * shipped charts drew grid lines at `--color-border`, the same weight as the
 * baseline.
 */
export const CHART_GRID_LINE_STROKE = v('sv-bg-inset', T.bgInset)

// ──────────────────────────────────────────────────────────────────────────────
// SERIES MARKS (bar / line / line point / area)
// ──────────────────────────────────────────────────────────────────────────────

/** Bar corner radius. Canvas `rx="1"`; the shipped bars set no `rx` at all. */
export const CHART_BAR_RADIUS = 1

/** Stroke width for a line series, and for the outline of an area series. */
export const CHART_LINE_STROKE_WIDTH = 2

/** Line-point radius. Canvas `r="3"`. */
export const CHART_POINT_RADIUS = 3

/**
 * Line-point FILL. Canvas draws each vertex as a RING —
 * `fill="#fefefe" stroke="{series}" stroke-width="2"` — so the point reads as a
 * marker punched out of the card rather than as a blob of series colour, and
 * stays legible where two series cross. The shipped points were solid fills in
 * the series colour.
 */
export const CHART_POINT_FILL = v('sv-bg-raised', T.bgRaised)

/** Line-point ring width. Canvas `stroke-width="2"`. */
export const CHART_POINT_STROKE_WIDTH = 2

/** Default area fill opacity. Canvas `fillOpacity = 0.4`; shipped default 0.3. */
export const CHART_AREA_FILL_OPACITY = 0.4

// ──────────────────────────────────────────────────────────────────────────────
// LEGEND (the `<ul>` strip beside the chart body)
// ──────────────────────────────────────────────────────────────────────────────

// Two axes, because the strip runs along whichever edge of the plot it occupies.
// The canvas draws a 14px gap between chips laid in a ROW (`top` / `bottom`,
// centred over the plot) and a 6px gap between chips STACKED in a column
// (`left` / `right`), where the chips read as a list rather than as a strip.
//
// The column axis was left unmodelled while the shell stacked every legend above
// the body regardless of what was declared — a parameter no caller could reach
// would have read as capability that existed. `legend.position` is a real
// placement now, so both axes are reachable and both are declared here.
//
// No padding of its own: the shell's `px-3 py-2.5` is the card's inset, and the
// legend's old `px-2 py-1` doubled it on the top edge.
const CHART_LEGEND_ROW = 'flex flex-wrap justify-center gap-3.5'

// `shrink-0` so a side legend keeps its content width and the plot absorbs the
// squeeze instead — the body is the element with a `min-w-0` escape hatch.
const CHART_LEGEND_COLUMN = 'flex flex-col shrink-0 gap-1.5'

/**
 * Compute the default className for the legend `<ul>`. `column` is the stacked
 * form used when the legend sits to the left or the right of the plot; the
 * default is the horizontal strip used above and below it.
 *
 * The `chart-legend` locator hook stays in the JSX — it is identity, not paint,
 * and specs select on it (`[class*="legend"]`).
 */
export const computeChartLegendClasses = ({
  column = false,
}: {
  column?: boolean
} = {}): string => (column ? CHART_LEGEND_COLUMN : CHART_LEGEND_ROW)

// ──────────────────────────────────────────────────────────────────────────────
// LEGENDCHIP (one series entry + its swatch)
// ──────────────────────────────────────────────────────────────────────────────

const CHART_LEGEND_CHIP = [
  // canvas: inline-flex, align-items:center, gap:6px
  'inline-flex items-center gap-1.5',
  // canvas 11px → the `text-xs` rung (11/16), exact. Was `text-md` (14).
  'text-xs',
  // canvas `#565656` (`prose`) → `sv-fg-muted` per the R-D colour mapping
  `text-[${v('sv-fg-muted', T.fgMuted)}]`,
].join(' ')

const CHART_LEGEND_CHIP_HIDDEN = 'opacity-40'

/**
 * Compute the default className for a legend entry's `<button>`. The `hidden`
 * axis is real: clicking a chip toggles its series off the canvas, and the chip
 * dims to show which series are currently suppressed.
 */
export const computeChartLegendChipClasses = ({
  hidden = false,
}: {
  hidden?: boolean
} = {}): string => (hidden ? `${CHART_LEGEND_CHIP} ${CHART_LEGEND_CHIP_HIDDEN}` : CHART_LEGEND_CHIP)

const CHART_LEGEND_CHIP_SWATCH = [
  // canvas: 10px box, `flex:none`. Was `size-3` (12px).
  'inline-block size-2.5 shrink-0',
  // canvas `border-radius:2px` → the `radius-sm` rung, exact. Was `rounded-sm`.
  `rounded-[${v('radius-sm', T.radiusSm)}]`,
].join(' ')

/**
 * Compute the default className for the colour swatch inside a legend chip.
 * Carries no colour: the series paint is a per-series runtime value and arrives
 * as an inline `backgroundColor`.
 */
export const computeChartLegendChipSwatchClasses = (): string => CHART_LEGEND_CHIP_SWATCH

// ──────────────────────────────────────────────────────────────────────────────
// TOOLTIP (in-SVG hover callout)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The tooltip is the single most visible change in this view, and it is an
 * INVERSION rather than a retune.
 *
 * The shipped tooltip was DARK: `<rect fill="var(--color-foreground)">` with
 * `<text fill="var(--color-background)">`. The canvas
 * (`spec-data.mjs`, `chartSvg`'s `tooltip` branch) draws a LIGHT one —
 * `rect rx="4" height="24" fill="#fefefe" stroke="#e3e3e3"`, text at
 * `font-size="10" fill="#131313"` — i.e. the same `raised` surface and `hair`
 * hairline as the card itself, so the callout reads as a small piece of the
 * chart's own chrome lifted off the canvas, not as a foreign dark chip.
 */

/** Callout height. Canvas `height="24"`; was 22. */
export const CHART_TOOLTIP_HEIGHT = 24

/** Callout corner radius. Canvas `rx="4"` — the `radius-base` step; was 3. */
export const CHART_TOOLTIP_RADIUS = 4

/** Callout surface. Canvas `#fefefe` (`raised`) — the inversion. */
export const CHART_TOOLTIP_FILL = v('sv-bg-raised', T.bgRaised)

/** Callout hairline. Canvas `stroke="#e3e3e3"` (`hair`); the shipped rect had none. */
export const CHART_TOOLTIP_STROKE = v('sv-border', T.border)

/** Callout text. Canvas `#131313` (`ink`) — the other half of the inversion. */
export const CHART_TOOLTIP_TEXT_FILL = v('sv-fg', T.fg)

/** Callout text size. Canvas `font-size="10"` — the `text-2xs` rung, exact; was 11. */
export const CHART_TOOLTIP_FONT_SIZE = 10

/**
 * Left inset of the callout text from the rect's own x. Canvas draws the text
 * at `x = tx + 8` with the DEFAULT (start) anchor, where the shipped tooltip
 * centred its text on the hovered point. Start-anchored text keeps the left
 * edge steady as the value's digit count changes.
 */
export const CHART_TOOLTIP_TEXT_INSET_X = 8

/**
 * Baseline of the callout text measured from the rect's own y. Canvas
 * `y = ty + 15` against a 24px box, with the default (alphabetic) baseline.
 */
export const CHART_TOOLTIP_TEXT_BASELINE_Y = 15

/**
 * Vertical clearance between the hovered point and the bottom of the callout.
 * Canvas puts the rect top at `sy(v) - 34` for a 24px box, so 10px of air.
 */
export const CHART_TOOLTIP_POINT_GAP = 10

/**
 * Per-character width estimate used to size the callout, at
 * {@link CHART_TOOLTIP_FONT_SIZE}. The canvas uses the same 5.4 figure; it is
 * calibrated for 10px text, which is why it moves with the font size rather
 * than staying at the 6.5 that the shipped 11px tooltip used.
 */
export const CHART_TOOLTIP_CHAR_WIDTH = 5.4

/**
 * Floor for the callout width, so a one- or two-character value still gets a
 * box wide enough to read as a callout rather than as a stray rectangle.
 */
export const CHART_TOOLTIP_MIN_WIDTH = 40
