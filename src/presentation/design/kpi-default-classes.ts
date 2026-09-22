/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the `kpi` data view (wave R-D).
 *
 * A KPI card is the smallest data view Sovrium ships: one metric, optionally
 * captioned, optionally trended, optionally sparklined. This module owns every
 * class that card paints so the SSR skeleton and the hydrated island are drawn
 * from ONE source and cannot drift apart on hydration.
 *
 * ## Why it lives in `presentation/utils/recipes`
 * The card is drawn TWICE: once by the SSR placeholder in
 * `ui/sections/rendering/component-registry/island-data-components.tsx` (a
 * `presentation-component`) and once by the hydrated island in
 * `islands/kpi/kpi-card.tsx` (a `presentation-island`).
 * `[internal ref]` forbids BOTH directions across that seam, so a
 * recipe both sides need can only live in `presentation-util`. Same reasoning
 * and same directory as `button-default-classes.ts` and
 * `navbar-default-classes.ts` — the F1 precedent.
 *
 * ## Safelist
 * The directory `src/presentation/utils/recipes` is registered in
 * `RECIPE_DIRS` (`src/infrastructure/css/arbitrary-var-safelist.ts`), so the
 * `v(…)` template literals below are resolved at build time and emitted into
 * the compiler's `@source inline(...)` safelist. A recipe whose arbitrary
 * classes are NOT safelisted emits no CSS rule at all and paints nothing.
 *
 * ## Colour / layout split
 * Colour, radius and shadow go through {@link withVarFallback} so an
 * `app.design.*` override still wins at the CSS cascade layer; layout, spacing
 * and type steps stay raw Tailwind because they encode structure, not colour.
 *
 * ## Type steps
 * Every size is a rung of the platform ladder
 * (`PLATFORM_TYPE_LADDER`, `inherited-tokens.generated.ts`) — `text-2xs` 10 ·
 * `text-xs` 11 · `text-sm` 12 · `text-base` 13 · `text-md` 14 · … ·
 * `text-4xl` 30/36. No arbitrary `text-[Npx]` anywhere.
 *
 * Parts covered (each maps 1:1 to an element the card already emits, so no
 * `data-*` attribute moves):
 *
 *   - CARD      — the `data-component="kpi"` surface: bordered, raised, flat
 *   - LABEL     — the `data-role="kpi-label"` caption beside the icon
 *   - ICON      — the `data-role="kpi-icon"` glyph wrapper
 *   - VALUE     — the `data-role="kpi-value"` metric, the card's focal element
 *   - TREND     — the `data-role="kpi-trend"` comparison row under the value
 *   - SPARKLINE — the `data-role="sparkline"` mini line chart at the bottom
 *
 * Canvas oracle: `spec-data.mjs:426-428` (`kpiCard`, `trendLine`, `sparkline`)
 * plus `variants.mjs:100` for the value's type step.
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// CARD — the outer `data-component="kpi"` surface
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `kpiCard`: 1px `hair` border · 6px radius · `raised` fill ·
// 12px/14px padding · NO shadow · flex column on a 4px gap.
//
// Three deliberate departures from what shipped before this wave:
//
//   - the radius drops from `rounded-lg` (8px) to `radius-md` (6px), which is
//     the radius every other R-D surface (list shell, gallery card, kanban
//     column, chart shell) now carries. A card that rounds harder than the
//     table beside it reads as a different system.
//   - `shadow-sm` is REMOVED. The canvas draws no elevation on a KPI: the card
//     is separated from the page ground by its border and its `raised` fill,
//     which is a layer difference rather than a lift. A metric is read, not
//     picked up.
//   - the column gap moves from per-child `mt-*` margins to one `gap-1` on the
//     container. With margins, an absent trend left the sparkline carrying its
//     own top margin against the value; with a gap the spacing is a property
//     of the stack and is correct for every combination of optional children.
const KPI_CARD = [
  'flex flex-col gap-1',
  'px-3.5 py-3',
  'border',
  `border-[${v('sv-border', T.border)}]`,
  `rounded-[${v('radius-md', T.radiusMd)}]`,
  `bg-[${v('sv-bg-raised', T.bgRaised)}]`,
].join(' ')

/**
 * Compute the default className for the outer KPI card surface — the element
 * that carries `data-component="kpi"`.
 *
 * Bordered and raised, on `radius-md`, with NO shadow: the canvas separates a
 * KPI from the page by layer and hairline, never by elevation. Padding is the
 * canvas' 12px/14px pair (`py-3` / `px-3.5`), tighter than the `p-4` that
 * shipped, because a KPI is a dense readout rather than a content card.
 *
 * Consumed by BOTH the hydrated `KpiCard` and the SSR skeleton, so the card
 * chrome is byte-identical across hydration and the metric never reflows.
 */
export const computeKpiCardClasses = (): string => KPI_CARD

/**
 * The label ROW — the flex line holding the optional icon and the caption.
 *
 * Not a "part" in its own right (it carries no `data-role`), so it ships as a
 * constant rather than a `compute*` export. The 6px gap is the canvas value;
 * `gap-2` (8px) let the glyph drift away from the word it labels.
 */
export const KPI_LABEL_ROW_CLASSES = 'flex items-center gap-1.5'

// ──────────────────────────────────────────────────────────────────────────────
// LABEL — the `data-role="kpi-label"` caption
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 11px, weight 400, `muted`. Two changes: the step drops from
// `text-md` (14) to `text-xs` (11), and `font-medium` is REMOVED. A caption
// competing with the metric at 14px medium is the single loudest thing wrong
// with the card that shipped — the number is the content, the caption is the
// key to it.
const KPI_LABEL = ['text-xs', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for the KPI caption (`data-role="kpi-label"`).
 *
 * 11px regular on the muted tone. Regular weight and the small rung are what
 * make it read as the metric's key rather than as a heading above it; the
 * canvas draws it at exactly this weight for that reason.
 *
 * Canvas `muted` maps to `sv-fg-muted` rather than to the value-exact
 * `sv-fg-subtle` — the wave-level role-over-value mapping recorded in the R-D
 * target table, following R-B's table header. The caption renders ~0.10 OkLab
 * lightness darker than the drawing; that is a named, accepted divergence.
 */
export const computeKpiLabelClasses = (): string => KPI_LABEL

// ──────────────────────────────────────────────────────────────────────────────
// ICON — the `data-role="kpi-icon"` glyph wrapper
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: `prose` (#565656). `prose` maps EXACTLY to `sv-fg-muted` (.453 vs
// .445), so the icon and the caption beside it now share one tone — they are
// one label, and painting the glyph a step lighter than its word (the previous
// `text-foreground-subtle`) split a single line into two.
//
// `shrink-0` keeps the glyph square when a long caption pushes the row: a flex
// child with intrinsic SVG geometry will otherwise compress on the main axis
// and the icon goes oval.
const KPI_ICON = ['inline-flex shrink-0', `text-[${v('sv-fg-muted', T.fgMuted)}]`].join(' ')

/**
 * Compute the default className for the KPI icon wrapper
 * (`data-role="kpi-icon"`).
 *
 * The glyph's BOX is 16px and is set on the `<svg>` itself (`width`/`height`
 * props on `LucideGlyph`) rather than here — lucide's renderer writes the
 * attributes, and a class fighting them would be resolved by whichever the
 * cascade happened to favour. This computer owns the tone and the flex
 * behaviour only.
 */
export const computeKpiIconClasses = (): string => KPI_ICON

// ──────────────────────────────────────────────────────────────────────────────
// VALUE — the `data-role="kpi-value"` metric
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: mono family, weight 600, nowrap + ellipsis.
//
// `font-mono` is the load-bearing one. A KPI is read as a QUANTITY and often
// sits in a grid beside its siblings; a proportional font gives `1` and `8`
// different widths, so a column of figures never aligns and a live-updating
// value jitters horizontally as its digits change. Tabular mono fixes both.
//
// `truncate` matters because the value is the one string on the card whose
// length the author does not control — a currency-formatted aggregate can be
// arbitrarily long, and without it the card grows and breaks the grid row it
// sits in.
//
// The type step is `text-4xl` (30/36). The Configuration drawing sets 26/32
// and the Rendering drawing 30/36; there is no 26/32 rung on the ladder and
// `text-4xl` IS 30/36 exactly, so R-D takes the Rendering figure. The weight
// (600) comes from the Configuration drawing, the only one that states one —
// down from the `font-bold` (700) that shipped.
const KPI_VALUE = 'truncate font-mono text-4xl font-semibold'

/**
 * Compute the default className for the KPI metric (`data-role="kpi-value"`).
 *
 * Colour is NOT included: the value's tone is the threshold map the island
 * computes (`THRESHOLD_COLOR_CLASS`), which resolves a configured threshold
 * name to a semantic role utility and falls back to `text-foreground`. Baking
 * a colour here would have to be overridden on every thresholded card, so the
 * recipe ships geometry and type and lets the caller append the tone.
 *
 * The rendered element also carries `data-threshold` when a threshold
 * resolved — that attribute is the stable hook specs assert on, and it is
 * untouched by this recipe.
 */
export const computeKpiValueClasses = (): string => KPI_VALUE

// ──────────────────────────────────────────────────────────────────────────────
// TREND — the `data-role="kpi-trend"` comparison row
// ──────────────────────────────────────────────────────────────────────────────

// Canvas `trendLine`: 12px, weight 400, 4px outer gap / 2px inner gap, no top
// margin of its own.
//
// The top margin is dropped because the card's `gap-1` now owns the vertical
// rhythm of the whole stack — `mt-1` on the trend plus a gap on the parent
// would double the space, and only under the combination that has both a value
// and a trend.
//
// `font-medium` is removed for the same reason it is removed from the label:
// the trend is context for the number, not a second number.
const KPI_TREND = ['flex items-center gap-1', 'text-sm'].join(' ')

/**
 * Compute the default className for the trend row (`data-role="kpi-trend"`).
 *
 * 12px regular on a 4px gap. Colour is NOT included: the direction tone
 * (`text-success-fg` / `text-error-fg` / `text-warning-fg` /
 * `text-foreground-muted`) is resolved by the island from the trend config and
 * appended by the caller, exactly as for the value.
 *
 * The row carries the OUTER 4px gap. The arrow and the percentage are one
 * group at the inner 2px gap — see {@link KPI_TREND_GROUP_CLASSES}.
 */
export const computeKpiTrendClasses = (): string => KPI_TREND

/**
 * The arrow + percentage pair inside the trend row, on the canvas' 2px INNER
 * gap.
 *
 * A glyph and the number it modifies are one token; at the row's 4px they read
 * as two. Ships as a constant rather than a `compute*` export because it
 * carries no `data-role` and is not a part in its own right — it is the inner
 * half of the trend's two-gap geometry.
 */
export const KPI_TREND_GROUP_CLASSES = 'inline-flex items-center gap-0.5'

// ──────────────────────────────────────────────────────────────────────────────
// SPARKLINE — the `data-role="sparkline"` mini line chart
// ──────────────────────────────────────────────────────────────────────────────

// Canvas: 28px tall, 6px above the trend, `S1` stroke at 1.5.
//
// The height moves from `h-8` (32) to `h-7` (28) and the top margin from
// `mt-2` (8) to `mt-1.5` (6). Both are on the sparkline rather than on the
// card's gap because the SVG's own `viewBox` is 28 units tall: matching the
// rendered box to the viewBox is what keeps `preserveAspectRatio="none"` from
// stretching the stroke vertically.
const KPI_SPARKLINE_CONTAINER = 'mt-1.5 w-full'

const KPI_SPARKLINE_SVG = 'h-7 w-full'

/**
 * The `S1` series hue — the first slot of the chart palette.
 *
 * Spelled as a raw `var()` with a hex fallback rather than through
 * {@link withVarFallback}, for two reasons: `sv-chart-1` has no entry in
 * `TOKENS` (the chart palette is scheme-invariant and is declared only by the
 * theme layer), and this value is consumed as an SVG `stroke` ATTRIBUTE, not
 * as a Tailwind arbitrary value — so it needs neither the underscore escaping
 * nor the safelist round-trip. Mirrors `DEFAULT_BAR_FILL` in
 * `islands/timeline/timeline-view.tsx`, which resolves the same slot the same
 * way.
 *
 * This replaces `text-primary` + `stroke="currentColor"`. A sparkline is a
 * SERIES, and painting it with the brand primary made a chart of one series
 * disagree with every other chart on the page, where series 1 is `S1`.
 */
export const KPI_SPARKLINE_STROKE = 'var(--sv-chart-1, #398ad6)'

/** The canvas stroke weight for the sparkline polyline (was 2). */
export const KPI_SPARKLINE_STROKE_WIDTH = 1.5

/**
 * Compute the default className for the sparkline wrapper
 * (`data-role="sparkline"`) or, with `part: 'svg'`, for the `<svg>` inside it.
 *
 * The wrapper owns the 6px offset from the trend above and full width; the
 * SVG owns the 28px height that matches its own viewBox. Splitting them is
 * what keeps the polyline unstretched — a wrapper-only height would let the
 * SVG size itself.
 */
export const computeKpiSparklineClasses = ({
  part = 'container',
}: {
  part?: 'container' | 'svg'
} = {}): string => (part === 'svg' ? KPI_SPARKLINE_SVG : KPI_SPARKLINE_CONTAINER)
