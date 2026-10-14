/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// What the Links directory and one link's deep-dive share: the grid id, the
// analytics window and queries, and the KPI, trend and panel helpers.

import { sectionCard } from '../../components/dashboard-blocks'
import { dataTable } from '../../components/data-table-blocks'
import { ANALYTICS_OVERVIEW_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * Id of the catalog grid — the `onSuccess.refetch` target of every write on the
 * directory, so a mint or a delete repaints the list rather than the page.
 */
export const CATALOG_GRID_ID = 'admin-links-catalog'

/**
 * Id of the deep-dive's full-definition drawer.
 *
 * The drawer is the ONLY place `targets[]` and `utm{}` can be rendered as
 * structure. `$record.<field>` coerces with `String(value)` and its grammar is
 * `[a-zA-Z0-9_]+` with no dots, so `$record.utm` prints `[object Object]` and
 * `$record.utm.source` prints `[object Object].source` — both measured. A
 * record-drawer `recordField` with `renderAs: 'key-value'` / `'list'` is the one
 * primitive that walks into a nested value, which is why the detail's richest
 * half is behind a row click rather than printed on the page.
 */
export const DEFINITION_DRAWER_ID = 'admin-link-definition-drawer'

/**
 * The three look-back windows, in rail order.
 *
 * 24 hours is too short to read a campaign and 30 days flattens a launch spike,
 * so 7 days sits in the middle and is the default.
 *
 * Only the ids are declared. `granularity` and `label` both DERIVE from the span
 * — `≤48h → hour`, `≤90d → day`; `7d → "last 7 days"` — and the derivations are
 * exactly the values the retired builder spelled out by hand, so restating them
 * would be three more places for the rail and the copy to drift apart.
 */
export const WINDOW = {
  param: 'period',
  default: '7d',
  presets: [{ id: '24h' }, { id: '7d' }, { id: '30d' }],
}

/**
 * The query every analytics read on both pages carries, spelled ONCE so a panel
 * cannot be added with a window of its own.
 *
 * All four panels of a page share this object, and the system-value hook keys
 * its cache on endpoint + query — so the three KPI tiles and the trend chart
 * collapse into a single request, and the Links specs assert it. Two
 * equivalent literals would
 * silently become two fetches.
 *
 * `event_type` is the whole point of binding the analytics readers rather than a
 * links-specific endpoint: one aggregation path over the click store, asked a
 * narrower question.
 */
export const CLICK_QUERY = {
  from: '$window.start',
  to: '$window.end',
  granularity: '$window.granularity',
  event_type: 'link_click',
} as const

/** The same query narrowed to the link the URL names. */
export const ONE_LINK_QUERY = { ...CLICK_QUERY, event_name: '$param.slug' } as const

/**
 * The same window and the same link, asked about the OTHER event the redirect
 * records.
 *
 * ─── WHY THIS EXISTS: "Clicks" DOES NOT MEAN "ARRIVALS" ───────────────────
 *
 * `routes.ts` records `qr_scan` instead of `link_click` when the request
 * carries the `?qr` marker the printed code embeds
 * (`link-click-analytics.ts:169`), so the two are disjoint sets over the same
 * redirect. Measured on this console: five requests to one slug, three of them
 * through the QR code, reported `pageViews: 2` under `link_click` and
 * `pageViews: 3` under `qr_scan`. Every scan of a code an operator printed and
 * put on a poster was therefore missing from the only figure this page
 * published, with nothing to say so.
 *
 * ─── AND WHY TWO FIGURES RATHER THAN ONE SUM ──────────────────────────────
 *
 * Because they answer different questions. "Clicks" is the link as a link — a
 * thing someone was sent and followed. "Scans" is the link as an object in the
 * world — a code on a poster, a card, a label — and the whole reason to print
 * one is to find out whether the paper worked. A single "Arrivals" figure adds
 * the two into a number that cannot answer either, and quietly redefines a
 * column every existing reading of this page was taken against.
 *
 * ─── THE TWO COSTS, NAMED ─────────────────────────────────────────────────
 *
 * It is a SECOND request. The system-value hook keys its cache on endpoint +
 * query, which is what collapses the click tiles and the trend chart into one
 * fetch, and a different `event_type` is a different query by construction.
 * One extra read per detail view is the honest price of a figure that was
 * missing entirely.
 *
 * And it is a DELIBERATE DEVIATION from the reference, which draws one metric
 * card on this page. The drawing was made before the QR half of the redirect
 * was measured; it is not wrong about the layout, only silent about a number
 * that turned out to exist.
 */
export const ONE_LINK_SCAN_QUERY = { ...ONE_LINK_QUERY, event_type: 'qr_scan' } as const

/**
 * The period rail: the three presets as real LINKS, the active one marked
 * `aria-current="page"`.
 *
 * Links rather than buttons because that is what they are — each addresses a
 * different document. Back and forward move between windows for free, a shared
 * link carries the window it was read at, and a reload survives it.
 *
 * `activeWhen` compares `$window.id`, which the substitution passes have already
 * resolved to a literal by the time it is evaluated; `activeProps` is MERGED
 * over `props` key by key, so the `className` is swapped rather than
 * concatenated. The alternative — a visibility gate — needs six links to render
 * three, each pair duplicating an href and a label so the two can drift.
 *
 * @param basePath - the page's own mount-relative path, so the rail keeps the
 *   operator where they are.
 */
export const periodRail = (basePath: string): PageComponent =>
  ({
    type: 'container',
    element: 'nav',
    props: {
      'aria-label': '$t:admin.links.period.region',
      className: 'border-border flex w-fit items-center gap-1 rounded-md border p-0.5',
    },
    children: WINDOW.presets.map((preset) => ({
      type: 'link',
      // The chip's caption is a KEY minted from the preset id, not the id
      // itself: `24h` and `7d` are English abbreviations, and a French console
      // writes "7 j". Deriving the key keeps the rail's three captions in the
      // catalogue without enumerating the presets a second time here.
      content: `$t:admin.links.period.${preset.id}`,
      props: {
        href: `${basePath}?period=${preset.id}`,
        className:
          'text-muted-foreground hover:text-foreground rounded px-2.5 py-1 text-sm font-medium',
      },
      activeWhen: { value: '$window.id', equals: preset.id },
      activeProps: {
        'aria-current': 'page',
        className: 'bg-card text-foreground rounded px-2.5 py-1 text-sm font-medium',
      },
    })),
  }) as PageComponent

/**
 * The one-line statement of which window the figures above cover.
 *
 * A click count is indistinguishable at any window: 412 over seven days and 412
 * over all time are the same three digits. The phrase appears exactly once per
 * document, so `getByText(/last 7 days/i)` resolves to one element.
 */
export const windowCopy = (): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    props: { className: 'text-foreground-subtle text-sm' },
    content: 'Measured over the $window.label.',
  }) as PageComponent

/**
 * One KPI tile reading a pre-computed scalar at `valuePath`.
 *
 * The label paints as visible text in the SSR skeleton, before the shared fetch
 * settles. Tiles over the same endpoint AND query collapse into one request —
 * the hook keys its cache on those two and NOT on the per-tile value path. The
 * cheap mistake, keying on the path too, is invisible except as N times the
 * load, which is why the spec asserts the request COUNT rather than the numbers.
 */
export const kpiTile = (
  label: string,
  endpoint: string,
  valuePath: string,
  query?: Readonly<Record<string, string>>
): PageComponent =>
  sectionCard({ label, endpoint, valuePath, ...(query === undefined ? {} : { system: { query } }) })

/**
 * The click trend, over the overview's TOP-LEVEL `timeSeries`.
 *
 * The chart hook reads `json[rowsKey]` as a plain key and never a dotted path,
 * which is why a NESTED series block binds to nothing and renders an empty chart
 * with no error anywhere.
 *
 * Its `emptyState` is the honest answer to a window with nothing in it: a flat
 * line at zero reads as "measured, and it was zero", which is a different claim
 * from "no clicks were recorded" — and the second is the only one the endpoint
 * supports.
 */
export const trendChart = (query: Readonly<Record<string, string>>): PageComponent =>
  ({
    type: 'chart',
    props: { 'aria-label': '$t:admin.links.trend.region' },
    dataSource: { system: { endpoint: ANALYTICS_OVERVIEW_ENDPOINT, rowsKey: 'timeSeries', query } },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    series: [
      { field: 'pageViews', label: 'Clicks' },
      { field: 'uniqueVisitors', label: 'Unique visitors' },
    ],
    emptyState: { role: 'region', name: 'No data', title: 'No clicks recorded in this period' },
  }) as PageComponent

/**
 * A read-only system-source grid over one reader.
 *
 * Every breakdown is the same shape, so they come from one helper rather than
 * five near-copies. A system-source grid keeps its native `<table>` role and
 * accessible name, so each resolves as `table "<label>"`.
 *
 * `idKey` is the row's identity, and where a reader's identity field is NULLABLE
 * (`referrers.domain` is null for direct traffic; every `campaigns.*` field is
 * null for untagged traffic) two such rows would normalize onto the same id —
 * `parseSystemEnvelope` maps `row[idKey]` onto `id` with no index fallback. Each
 * reader groups its rows, so the null bucket collapses to at most one row per
 * grid; that is an observed property of the queries rather than a guarantee the
 * schema makes, and it is recorded here so a future grouping change is caught.
 */
export const systemGrid = (config: {
  readonly label: string
  readonly endpoint: string
  readonly rowsKey: string
  readonly idKey: string
  readonly columns: ReadonlyArray<Record<string, unknown>>
  readonly emptyMessage: string
  readonly query?: Readonly<Record<string, string>>
}): PageComponent =>
  dataTable({
    props: { 'aria-label': config.label },
    dataSource: {
      system: {
        endpoint: config.endpoint,
        rowsKey: config.rowsKey,
        idKey: config.idKey,
        ...(config.query === undefined ? {} : { query: config.query }),
      },
    },
    columns: config.columns,
    emptyMessage: config.emptyMessage,
  }) as PageComponent

/** A labelled section wrapping one or more panels, with its own heading. */
export const panelSection = (
  label: string,
  children: ReadonlyArray<PageComponent>
): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-md font-medium' },
        content: label,
      },
      ...children,
    ],
  }) as PageComponent

/**
 * The static "analytics not enabled" note.
 *
 * The catalog still renders beneath it: link DEFINITIONS do not depend on
 * analytics, and hiding them would be a worse answer than an honest gap where
 * the metrics would be.
 */
export const analyticsDisabledNote = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    visibility: { unlessDeclares: 'analytics' },
    props: {
      'aria-label': '$t:admin.links.unavailable.region',
      className: 'border-border bg-card mt-2 flex flex-col gap-2 rounded-lg border p-6',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-md font-medium' },
        content: '$t:admin.links.unavailable.heading',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-muted-foreground max-w-xl text-md leading-relaxed' },
        content: '$t:admin.links.unavailable.body',
      },
    ],
  }) as PageComponent
