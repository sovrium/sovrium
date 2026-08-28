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
 *     native `<table>` role so it resolves as `table "Most-viewed pages"`;
 *  4. an **Acquisition** section — Top referrers (`/referrers`) beside Campaigns
 *     (`/campaigns`), read together because a spike in one usually explains the
 *     other;
 *  5. a **Technology** section — device types / browsers / operating systems,
 *     three grids over ONE `/devices` response (three arrays in one envelope),
 *     so the three panels cost a single request;
 *  6. an **Event log** — the raw `/events` feed, unfiltered by type.
 *
 * All six read the SAME baked window, so the page reports one consistent period
 * throughout. Every endpoint above already shipped and is admin-gated; before
 * this change only `/overview` and `/pages` were consumed, so four of the six
 * were dark.
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

/** Top referring domains over the window (`{ referrers, total }`). */
const REFERRERS_ENDPOINT = '/api/analytics/referrers'

/**
 * Device / browser / OS breakdown over the window. One response carries THREE
 * arrays (`deviceTypes` / `browsers` / `operatingSystems`), so the three grids
 * below bind the same endpoint with different `rowsKey`s and share ONE fetch
 * (the system-source hook dedupes on endpoint + query).
 */
const DEVICES_ENDPOINT = '/api/analytics/devices'

/** UTM campaign attribution over the window (`{ campaigns, total }`). */
const CAMPAIGNS_ENDPOINT = '/api/analytics/campaigns'

/** The raw custom-event log (`{ events, pagination }`) — rows carry a real `id`. */
const EVENTS_ENDPOINT = '/api/analytics/events'

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
function intro(analyticsEnabled: boolean): Component {
  // The lede describes what the page SHOWS, so it has to track whether the page
  // can show anything. Promising "views, visitors, sessions, the trend over
  // time…" directly above an "Analytics is not enabled" panel reads as a broken
  // page rather than an unconfigured one — the reader cannot tell whether the
  // numbers are missing or merely off.
  return dataPageIntro(
    'Analytics',
    analyticsEnabled
      ? 'Measure your pages’ audience over the last 30 days: views, visitors, and sessions, the trend over time, the most-viewed pages, where the traffic came from, what it browsed with, and the raw event log.'
      : 'Measure your pages’ audience — views, visitors, sessions and their sources. Analytics is off for this app; turn it on to start collecting.'
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
 * A generic system-source acquisition/breakdown grid over the baked window.
 * Every panel below is the same shape — a read endpoint, a `rowsKey`, an
 * identity field, and explicit columns — so they are built from one helper
 * rather than four near-copies.
 *
 * `idKey` is the row's identity. Where the endpoint's identity field is
 * NULLABLE (`referrers.domain` is null for direct traffic; every
 * `campaigns.*` field is nullable for untagged traffic) two such rows would
 * normalize onto the same `id` — see `parseSystemEnvelope`, which maps
 * `row[idKey]` onto `id` with no index fallback. In practice each endpoint
 * groups its rows, so the null bucket collapses to at most one row per grid;
 * that is an observed property of the queries, not a guarantee the schema
 * makes, and it is recorded here so a future grouping change is caught.
 */
function breakdownTable(config: {
  readonly label: string
  readonly endpoint: string
  readonly rowsKey: string
  readonly idKey: string
  readonly columns: ReadonlyArray<Record<string, unknown>>
  readonly emptyMessage: string
  readonly query: Record<string, unknown>
}): Component {
  return {
    type: 'data-table',
    props: { 'aria-label': config.label },
    dataSource: {
      system: {
        endpoint: config.endpoint,
        rowsKey: config.rowsKey,
        idKey: config.idKey,
        query: config.query,
      },
    },
    columns: config.columns,
    emptyMessage: config.emptyMessage,
  } as unknown as Component
}

/** A labelled section wrapping one or more panels, with its own heading. */
function panelSection(label: string, children: ReadonlyArray<Component>): Component {
  return {
    type: 'container',
    element: 'section',
    props: { className: 'flex flex-col gap-3', 'aria-label': label },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: label,
      },
      ...children,
    ],
  } as unknown as Component
}

/**
 * Acquisition: where the audience came from. Referrers and campaigns sit
 * side-by-side because an operator reads them together — a spike in one is
 * usually explained by the other.
 */
function acquisitionSection(w: AnalyticsWindow): Component {
  const window = { from: w.from, to: w.to }
  return panelSection('Acquisition', [
    {
      type: 'container',
      props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-2' },
      children: [
        breakdownTable({
          label: 'Top referrers',
          endpoint: REFERRERS_ENDPOINT,
          rowsKey: 'referrers',
          idKey: 'domain',
          columns: [
            { field: 'domain', label: 'Referrer' },
            { field: 'pageViews', label: 'Views', align: 'right' },
            { field: 'uniqueVisitors', label: 'Visitors', align: 'right' },
          ],
          emptyMessage: 'No referrers in this period',
          query: window,
        }),
        breakdownTable({
          label: 'Campaigns',
          endpoint: CAMPAIGNS_ENDPOINT,
          rowsKey: 'campaigns',
          idKey: 'campaign',
          columns: [
            { field: 'campaign', label: 'Campaign' },
            { field: 'source', label: 'Source' },
            { field: 'medium', label: 'Medium' },
            { field: 'pageViews', label: 'Views', align: 'right' },
          ],
          emptyMessage: 'No tagged campaigns in this period',
          query: window,
        }),
      ],
    } as unknown as Component,
  ])
}

/**
 * Technology: the device / browser / OS split. Three grids over ONE
 * `/api/analytics/devices` response (three arrays in one envelope), so the
 * three panels cost a single request.
 */
function technologySection(w: AnalyticsWindow): Component {
  const window = { from: w.from, to: w.to }
  const columns = [
    { field: 'name', label: 'Name' },
    { field: 'count', label: 'Visits', align: 'right' },
    // The endpoint already returns a percentage (33.33, not 0.3333), and there
    // is no percent formatter that leaves an already-scaled number alone — so
    // the unit lives in the header rather than being applied twice to the cell.
    { field: 'percentage', label: 'Share %', align: 'right' },
  ]
  return panelSection('Technology', [
    {
      type: 'container',
      props: { className: 'grid grid-cols-1 gap-4 lg:grid-cols-3' },
      children: [
        breakdownTable({
          label: 'Device types',
          endpoint: DEVICES_ENDPOINT,
          rowsKey: 'deviceTypes',
          idKey: 'name',
          columns,
          emptyMessage: 'No devices recorded',
          query: window,
        }),
        breakdownTable({
          label: 'Browsers',
          endpoint: DEVICES_ENDPOINT,
          rowsKey: 'browsers',
          idKey: 'name',
          columns,
          emptyMessage: 'No browsers recorded',
          query: window,
        }),
        breakdownTable({
          label: 'Operating systems',
          endpoint: DEVICES_ENDPOINT,
          rowsKey: 'operatingSystems',
          idKey: 'name',
          columns,
          emptyMessage: 'No operating systems recorded',
          query: window,
        }),
      ],
    } as unknown as Component,
  ])
}

/**
 * The event log: every analytics event the app recorded in the window, newest
 * first. Rows carry a real `id`, so no identity normalization is needed.
 *
 * Named "Event log" rather than "Custom events" ON PURPOSE. The endpoint takes
 * an optional `event_type` filter but applies NONE by default, so the feed
 * carries `page_view` rows alongside author-emitted ones — a panel titled
 * "Custom events" over that feed would be a wrong-answer label. Page views ARE
 * events; the `Type` column is what separates them, and the operator can read
 * it. Filtering to a single type would mean hardcoding a value out of a
 * free-form vocabulary (`event_type` is an arbitrary string, not an enum), and
 * guessing it would silently hide whatever an app actually emits.
 *
 * Field names here are `snake_case` because THIS endpoint's projection is
 * snake_case (`analytics.ts:445-455`), unlike every other admin endpoint the
 * console binds. That inconsistency is recorded as a finding, not papered over:
 * camelCase bindings render blank cells, which is exactly how it was found.
 */
function eventLogSection(w: AnalyticsWindow): Component {
  return panelSection('Event log', [
    breakdownTable({
      label: 'Event log',
      endpoint: EVENTS_ENDPOINT,
      rowsKey: 'events',
      idKey: 'id',
      columns: [
        { field: 'event_name', label: 'Event' },
        { field: 'event_type', label: 'Type' },
        { field: 'timestamp', label: 'Recorded', format: 'datetime' },
      ],
      emptyMessage: 'No events in this period',
      query: { from: w.from, to: w.to },
    }),
  ])
}

/**
 * The live analytics body (analytics enabled): the KPI strip and timeseries
 * chart over the whole audience, then the three breakdown sections —
 * acquisition (referrers + campaigns), technology (device / browser / OS), and
 * the custom-event log. Every panel is a generic system-bound component reading
 * the SAME baked window, so the page reports one consistent period throughout.
 *
 * The window itself is still fixed: there is no interactive period selector,
 * because `dataSource.system.query` is resolved once at render and the surface
 * builder receives no request context. Making it interactive is a platform
 * capability, not config.
 */
function analyticsBody(w: AnalyticsWindow): Component {
  return {
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-8 pt-2' },
    children: [
      kpiStrip(w),
      audienceChart(w),
      topPagesTable(w),
      acquisitionSection(w),
      technologySection(w),
      eventLogSection(w),
    ],
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
    components: wrapInShell([intro(analyticsEnabled), body], {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label: 'Analytics', href: '/_admin/pages' }],
    }),
  } as Page
}
