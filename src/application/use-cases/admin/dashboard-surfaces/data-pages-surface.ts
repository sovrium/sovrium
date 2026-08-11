/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab **Analytics** page.
 *
 * `/_admin/pages` opens a flat Plausible-style page-analytics dashboard — NOT a
 * per-object rail (audience is app-wide, not per-object).
 *
 * DOGFOODING: the surface is now composed ENTIRELY from GENERIC
 * Sovrium config bound to the EXISTING page-view analytics backend (no new
 * backend) over a BAKED default 30-day window — NOT a bespoke per-analytics
 * island. There is no interactive period selector
 * (deferred platform gap — the chart/kpi `dataSource.system` `query` is static);
 * the window (`from = now − 30d` / `to = now` / `granularity = day`) is resolved
 * ONCE per render and carried in every system read's `query`, so the three
 * components share one consistent window.
 *
 * When the operator declares NO `analytics` block, every `/api/analytics/*`
 * endpoint 404s, so the surface renders a STATIC "Analytics not enabled"
 * region (`<section role=region>` — what + how to enable) and NO live components.
 *
 * When analytics IS enabled, the body composes three generic system-bound
 * components over the baked window:
 *  1. a KPI strip — three `kpi` tiles (Pages vues / Visiteurs uniques / Sessions)
 *     reading scalars from `GET /api/analytics/overview` via `dataSource.system`
 *     valuePaths, wrapped in a labelled `region "Indicateurs d’audience"`. The
 *     three tiles share ONE overview fetch (the system-value hook dedupes on the
 *     endpoint + query);
 *  2. a timeseries `chart` (area) bound to the overview `timeSeries` rows
 *     (`rowsKey`) with a configurable accessible name
 *     (`props['aria-label']` → `img "Audience trend"`) AND a named
 *     empty-state region (`emptyState` → `region "No data"` carrying
 *     "No visits in this period" when the window has zero recorded views);
 *  3. a Top-pages `data-table` bound to `GET /api/analytics/pages` (`rowsKey:
 *     pages`), columns Page / Views / Visitors — a SYSTEM-source grid keeps its
 *     native `<table>` role so it resolves as `table "Most-viewed pages"`.
 *
 * Wrapped in the persistent shell. The breadcrumb anchors it under Console /
 * Data.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import { dataPageIntro } from './data-object-rail'
import type { DataShellOptions } from './data-landing-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/** The page-view analytics overview endpoint (totals + timeseries over the window). */
const OVERVIEW_ENDPOINT = '/api/analytics/overview'

/** The top-pages endpoint (most-consulted paths over the window). */
const PAGES_ENDPOINT = '/api/analytics/pages'

/**
 * The baked default look-back window: 30 days back, daily buckets. Resolved ONCE
 * per page render and carried in every system read's `query` so the KPI strip,
 * the timeseries chart, and the top-pages table all read the SAME window. There
 * is no interactive period selector (deferred platform gap); the window is fixed.
 */
interface AnalyticsWindow {
  readonly from: string
  readonly to: string
  readonly granularity: 'day'
}

/** Resolve the baked default 30-day / daily window (`from = now − 30d`, `to = now`). */
function defaultWindow(): AnalyticsWindow {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString(), granularity: 'day' }
}

/** The page intro: heading + orienting one-liner (the h2 the spec resolves). */
function intro(): Component {
  return dataPageIntro(
    'Analytics',
    'Measure your pages’ audience: views, unique visitors, and sessions over the last 30 days, with the trend over time and the most-viewed pages.'
  )
}

/**
 * The "analytics not enabled" state (analytics block absent → `/api/analytics/*`
 * 404s): a STATIC named `<section role=region>` "Analytics not enabled"
 * explaining what is off + how to enable it. NO live components — there is
 * nothing to query when the backend group is unregistered.
 */
function analyticsDisabledRegion(): Component {
  return {
    type: 'container',
    element: 'section',
    props: {
      'aria-label': 'Analytics not enabled',
      className:
        'border-border bg-background-raised mt-2 flex flex-col items-center gap-2 rounded-lg border p-10 text-center',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground text-sm font-medium' },
        content: 'Analytics is not enabled',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-muted max-w-md text-sm leading-relaxed' },
        content:
          'Enable analytics in your app config (analytics) to measure your pages’ audience, visitors, and sessions.',
      },
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle mt-1 max-w-md text-sm italic' },
        content: 'Nothing to measure until analytics is enabled.',
      },
    ],
  } as unknown as Component
}

/**
 * A single audience KPI tile reading a pre-computed scalar at `valuePath` from the
 * analytics overview envelope over the baked window. The label paints as visible
 * text in the `kpi` SSR skeleton pre-hydration (so the spec resolves it before the
 * shared overview fetch settles).
 */
function kpiTile(label: string, valuePath: string, w: AnalyticsWindow): Component {
  return {
    type: 'kpi',
    label,
    dataSource: {
      system: {
        endpoint: OVERVIEW_ENDPOINT,
        valuePath,
        query: { from: w.from, to: w.to, granularity: w.granularity },
      },
    },
    kpiFormat: { type: 'number' },
  } as unknown as Component
}

/**
 * The KPI strip: a labelled `<section role=region>` "Indicateurs d’audience"
 * wrapping the three audience figures (Pages vues / Visiteurs uniques / Sessions),
 * each a generic `kpi` bound to the overview endpoint over the baked window. The
 * three tiles share ONE overview fetch (the system-value hook dedupes on the
 * endpoint + query).
 */
function kpiStrip(w: AnalyticsWindow): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'pt-2', 'aria-label': 'Audience metrics' },
    children: [
      {
        type: 'container',
        props: { className: 'grid grid-cols-1 gap-4 sm:grid-cols-3' },
        children: [
          kpiTile('Page views', 'summary.pageViews', w),
          kpiTile('Unique visitors', 'summary.uniqueVisitors', w),
          kpiTile('Sessions', 'summary.sessions', w),
        ],
      } as unknown as Component,
    ],
  } as unknown as Component
}

/**
 * The audience timeseries: a generic AREA `chart` bound to the overview
 * `timeSeries` rows (`rowsKey`) over the baked window. Its configurable
 * accessible name (`props['aria-label']`) makes the SVG resolve as
 * `img "Audience trend"`; its named `emptyState` makes the ZERO-rows
 * branch render an accessible `region "No data"` carrying
 * "No visits in this period" (present-when-empty, absent-when-populated) —
 * the faithful carrier of the spec's empty-state region.
 */
function audienceChart(w: AnalyticsWindow): Component {
  return {
    type: 'chart',
    props: { 'aria-label': 'Audience trend' },
    dataSource: {
      system: {
        endpoint: OVERVIEW_ENDPOINT,
        rowsKey: 'timeSeries',
        query: { from: w.from, to: w.to, granularity: w.granularity },
      },
    },
    chartType: 'area',
    xAxis: { field: 'period', format: 'date' },
    series: [
      { field: 'pageViews', label: 'Page views' },
      { field: 'uniqueVisitors', label: 'Unique visitors' },
      { field: 'sessions', label: 'Sessions' },
    ],
    emptyState: {
      role: 'region',
      name: 'No data',
      title: 'No visits in this period',
    },
  } as unknown as Component
}

/**
 * The Top-pages table: a generic system-source `data-table` bound to
 * `GET /api/analytics/pages` (`rowsKey: pages`, keyed on `path`) over the baked
 * window, columns Page / Views / Visitors. A system-source grid keeps its native
 * `<table>` role + accessible name, so it resolves as
 * `table "Most-viewed pages"`.
 */
function topPagesTable(w: AnalyticsWindow): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': 'Most-viewed pages' },
    dataSource: {
      system: {
        endpoint: PAGES_ENDPOINT,
        rowsKey: 'pages',
        idKey: 'path',
        query: { from: w.from, to: w.to },
      },
    },
    columns: [
      { field: 'path', label: 'Page' },
      { field: 'pageViews', label: 'Views', align: 'right' },
      { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
    ],
    emptyMessage: 'No pages viewed in this period',
  } as unknown as Component
}

/**
 * The live analytics body (analytics enabled): the KPI strip, the timeseries
 * chart, and the Top-pages table — three generic system-bound components over the
 * baked default window.
 */
function analyticsBody(w: AnalyticsWindow): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-6 pt-2' },
    children: [kpiStrip(w), audienceChart(w), topPagesTable(w)],
  } as unknown as Component
}

/**
 * Build the Analytics page (`/_admin/pages`), wrapped in the persistent shell.
 *
 * @param options - the shell concerns (editing posture + operator slug/snapshot).
 * @param analyticsEnabled - whether the operator declared an `analytics` block.
 *   When `false`, every `/api/analytics/*` endpoint 404s, so the body is the
 *   static "Analytics not enabled" region (no live components); when `true`,
 *   the body is the live KPI strip + chart + top-pages table over the baked
 *   30-day window.
 */
export function buildDataPagesPage(options: DataShellOptions, analyticsEnabled: boolean): Page {
  const body = analyticsEnabled ? analyticsBody(defaultWindow()) : analyticsDisabledRegion()
  return {
    id: 'dashboard-data-pages',
    name: 'dashboard-data-pages',
    path: '/pages',
    meta: { title: 'Sovrium — Data · Analytics' },
    components: wrapInShell([intro(), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Analytics', href: '/_admin/pages' }],
      publishedSnapshot: options.publishedSnapshot ?? {},
    }),
  } as Page
}
