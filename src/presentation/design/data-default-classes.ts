/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default class computers for the data-cluster surfaces —
 * the kanban column + card, and the chart shell. These are the outer-chrome
 * subparts that the `ui-kit-data` cluster snapshot showcases — the "schema
 * author's preview" of what a populated data display looks like.
 *
 * Each helper paints COLOR / BORDER-COLOR through the shadcn role utilities
 * and RADIUS / SHADOW through {@link withVarFallback}, so `app.design.*`
 * overrides still win at the CSS cascade layer (the variable first, the
 * inline literal as its fallback); layout / spacing classes (`flex
 * flex-col`, `grid grid-cols-4`, `gap-2`, `px-4`) stay raw — they encode
 * structure, not color. Mirrors the buttons + inputs + selects + toggles +
 * numeric + date + overlays + disclosure + feedback + navigation + layout
 * + forms slices.
 *
 * Subparts covered:
 *
 *   - KANBAN COLUMN / CARD  — moved to `kanban-default-classes.ts`, which
 *                             both the board island and its skeleton read.
 *
 *   - CHART SHELL           — the outer wrapper around a chart canvas
 *                             (border + bg + radius + p-4). Pure surface
 *                             chrome — the chart content inside (bars,
 *                             lines, axes) carries its own colour from the
 *                             chart palette.
 *
 * Intentionally NOT covered (this slice scopes to what the `ui-kit-data`
 * cluster snapshot actually showcases — chart bar fills, data-table
 * internal subparts living inside `data-table/island/`, and other data
 * surfaces like `gallery` / `kpi` / `data-timeline` are out of scope for
 * this slice):
 *
 *   - CHART BAR FILL        — the `bg-primary` color on individual bars is
 *                             a single-class concern; wiring a helper that
 *                             proxies one token would only add indirection.
 *                             Reuses the same `primary` role that buttons
 *                             already register, so theme overrides flow
 *                             through naturally.
 *   - DATA-TABLE INTERNALS  — sort icon, selection checkbox, pagination
 *                             footer, toolbar chrome, filter dropdowns,
 *                             column reorder UI, settings dialog: ALL live
 *                             inside `src/presentation/islands/data-table/`
 *                             and have their own the prestyled-islands rule follow-up tracked
 *                             separately. Restyling them needs the island-
 *                             side bundle to ship the var-fallback
 *                             registrations rather than an SSR-side helper.
 *   - GALLERY / KPI / TIMELINE — these have their own SSR placeholders in
 *                             `island-data-components.tsx` using the same
 *                             theme-classname recipe; a follow-up slice can
 *                             expand `data-default-classes.ts` to cover
 *                             them once the cluster fixture exercises them
 *                             (the current `ui-kit-data` cluster shows only
 *                             data-table + kanban + chart).
 */

import { TOKENS as T, withVarFallback as v } from '@/presentation/design/css-var'

// ──────────────────────────────────────────────────────────────────────────────
// CHART SHELL — outer wrapper around the chart canvas
// ──────────────────────────────────────────────────────────────────────────────

const CHART_SHELL = [
  'p-4',
  'bg-background',
  'border',
  'border-border',
  `rounded-[${v('radius-md', T.radiusMd)}]`,
].join(' ')

/**
 * Compute the default className for the chart shell — the outer wrapper
 * around the chart's SVG canvas (or its SSR loading skeleton). Pure surface
 * chrome: border + radius + bg + padding so the chart canvas (bars,
 * lines, axes, legends) reads as a self-contained card on the page.
 *
 * The chart canvas itself (inside) carries its own colouring from the chart
 * palette — only the OUTER chrome is painted here. Consumed by
 * the cluster fixture's chart simulacrum and by the production SSR
 * placeholder in `island-chart-component.tsx` so the loading skeleton
 * paints the same shell as the hydrated chart.
 */
export const computeChartShellClasses = (): string => CHART_SHELL
